import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from "expo-audio";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ViewId } from "@align/contracts";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ProgressRail } from "../src/components/ProgressRail";
import { createLiveFrameSampler } from "../src/lib/liveFrameSampler";
import { liveScanPhase, advanceLiveScan } from "../src/lib/liveScanFlow";
import { createOperationGate } from "../src/lib/operationGate";
import { voiceButtonAction } from "../src/lib/voiceInteraction";
import { cacheCoachAudio } from "../src/services/audioFile";
import { coachErrorMessage } from "../src/services/request";
import { askCoach, requestGuidance } from "../src/services/coach";
import { discardCaptures, discardLocalFiles, persistCapture } from "../src/services/captures";
import { resetLiveSession, uploadLiveFrame } from "../src/services/liveCoach";
import { useScan } from "../src/state/ScanContext";
import { colors, radius, spacing } from "../src/theme";
import { pauseAudioSafely } from "../src/lib/audioLifecycle";

const MAX_VOICE_RECORDING_MS = 15_000;

export default function ScanScreen() {
  const [permission] = useCameraPermissions();
  const camera = useRef<CameraView | null>(null);
  const cameraBusy = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const liveUploadController = useRef<AbortController | null>(null);
  const captureGate = useRef(createOperationGate()).current;
  const questionGate = useRef(createOperationGate()).current;
  const liveSampler = useRef(createLiveFrameSampler()).current;
  const liveStartedAt = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef(0);
  const livePausedAt = useRef<number | null>(null);
  const liveFrameCountRef = useRef(0);
  const localViewsRef = useRef(new Set<ViewId>());
  const voiceActivityRef = useRef(false);
  const mounted = useRef(true);
  const recorderActive = useRef(false);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coachAudioFile = useRef<string | null>(null);
  const { scanId, captures, cloudCoachEnabled, coachCaption, setCapture, setCoachCaption, setGuidanceReport, reset } = useScan();
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string>();
  const [liveStarted, setLiveStarted] = useState(false);
  const [liveComplete, setLiveComplete] = useState(false);
  const [liveElapsedMs, setLiveElapsedMs] = useState(0);
  const [liveFrameCount, setLiveFrameCount] = useState(0);
  const [preparingRecording, setPreparingRecording] = useState(false);
  const [recording, setRecording] = useState(false);
  const [coachBusy, setCoachBusy] = useState(false);
  const [error, setError] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [awaitingGuidance, setAwaitingGuidance] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(null);
  const livePhase = liveScanPhase(liveElapsedMs);
  const active = livePhase.view;
  voiceActivityRef.current = preparingRecording || recording || coachBusy;

  const takeCameraPhoto = async (quality: number) => {
    if (!camera.current || cameraBusy.current) throw new Error("camera_busy");
    cameraBusy.current = true;
    try {
      return await camera.current.takePictureAsync({ quality, shutterSound: false });
    } finally {
      cameraBusy.current = false;
    }
  };

  const pauseLiveClock = () => {
    if (liveStartedAt.current !== null && livePausedAt.current === null) livePausedAt.current = Date.now();
  };

  const resumeLiveClock = () => {
    if (liveStartedAt.current !== null && livePausedAt.current !== null) {
      liveStartedAt.current += Date.now() - livePausedAt.current;
    }
    livePausedAt.current = null;
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      captureGate.cancel();
      questionGate.cancel();
      liveSampler.stop();
      requestController.current?.abort();
      liveUploadController.current?.abort();
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      recorderActive.current = false;
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      void discardLocalFiles(coachAudioFile.current);
    };
  }, [captureGate, liveSampler, questionGate]);

  useEffect(() => {
    if (!liveStarted || liveComplete) return;
    let cancelled = false;

    const sample = async () => {
      const startedAt = liveStartedAt.current;
      if (startedAt === null || cancelled) return;
      const now = Date.now();
      const delta = livePausedAt.current !== null || voiceActivityRef.current ? 0 : now - lastTickRef.current;
      lastTickRef.current = now;
      const elapsedMs = advanceLiveScan(elapsedRef.current, delta, localViewsRef.current);
      elapsedRef.current = elapsedMs;
      const phase = liveScanPhase(elapsedMs);
      if (mounted.current) setLiveElapsedMs(elapsedMs);
      const ready = localViewsRef.current.size === 4;
      if (phase.complete && ready && !liveSampler.isInFlight() && !cameraBusy.current) {
        liveSampler.stop();
        setLiveStarted(false);
        setLiveComplete(true);
        if (cloudCoachEnabled) setAwaitingGuidance(true);
        else router.replace("/recap");
        return;
      }
      if (!camera.current || cameraBusy.current || voiceActivityRef.current || !liveSampler.tryStart(Date.now())) return;

      const operation = captureGate.begin();
      let temporaryPhoto: string | undefined;
      let stagedPhoto: string | undefined;
      let stagedRegistered = false;
      let completed = false;
      let uploadController: AbortController | null = null;
      setBusy(true);
      try {
        const photo = await takeCameraPhoto(0.5);
        const capturedAtMs = Date.now();
        temporaryPhoto = photo.uri;
        if (cancelled || !mounted.current || !captureGate.isActive(operation)) return;
        stagedPhoto = await persistCapture(scanId, phase.view, photo.uri);
        if (cancelled || !mounted.current || !captureGate.isActive(operation)) return;
        setCapture(phase.view, stagedPhoto);
        stagedRegistered = true;
        localViewsRef.current.add(phase.view);
        liveFrameCountRef.current += 1;
        if (mounted.current) setLiveFrameCount(liveFrameCountRef.current);
        if (cloudCoachEnabled) {
          uploadController = new AbortController();
          liveUploadController.current = uploadController;
          const uploadTimeout = setTimeout(() => uploadController?.abort(), 4_000);
          try {
            await uploadLiveFrame({
              scanId,
              requestId: `frame-${capturedAtMs}`,
              capturedAtMs,
              view: phase.view,
              imageUri: photo.uri,
              signal: uploadController.signal,
            });
          } catch {
            // Retained local images are sent again with the final report request.
          } finally {
            clearTimeout(uploadTimeout);
          }
        }
        if (mounted.current) setCaptureError("");
        completed = true;
      } catch {
        if (mounted.current && captureGate.isActive(operation)) {
          setCaptureError("Camera capture missed. Hold this view while Align retries.");
        }
      } finally {
        if (liveUploadController.current === uploadController) liveUploadController.current = null;
        if (completed) liveSampler.markCaptureComplete();
        else liveSampler.markCaptureFailure();
        if (stagedPhoto && !stagedRegistered) await discardLocalFiles(stagedPhoto);
        await discardLocalFiles(temporaryPhoto);
        if (mounted.current) setBusy(false);
      }
    };

    void sample();
    const timer = setInterval(() => void sample(), 150);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [captureGate, cloudCoachEnabled, liveComplete, liveSampler, liveStarted, scanId]);

  const startLiveScan = () => {
    if (!cameraReady || !camera.current || cameraBusy.current || liveStarted) return;
    captureGate.cancel();
    liveSampler.reset();
    liveStartedAt.current = Date.now();
    lastTickRef.current = Date.now();
    elapsedRef.current = 0;
    livePausedAt.current = null;
    liveFrameCountRef.current = 0;
    localViewsRef.current = new Set();
    setLiveElapsedMs(0);
    setLiveFrameCount(0);
    setLiveComplete(false);
    setAwaitingGuidance(false);
    setError("");
    setCaptureError("");
    setLiveStarted(true);
  };

  const startQuestion = async () => {
    if (!cloudCoachEnabled || coachBusy || preparingRecording || recording || cameraBusy.current) return;
    const operation = questionGate.begin();
    if (liveStarted) pauseLiveClock();
    voiceActivityRef.current = true;
    setPreparingRecording(true);
    try {
      setError("");
      pauseAudioSafely(player);
      const microphone = await requestRecordingPermissionsAsync();
      if (!mounted.current || !questionGate.isActive(operation)) return;
      if (!microphone.granted) {
        setError("Microphone access is needed to ask the coach. You can enable it in iOS Settings.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!mounted.current || !questionGate.isActive(operation)) {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        return;
      }
      await recorder.prepareToRecordAsync();
      if (!mounted.current || !questionGate.isActive(operation)) {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        await discardLocalFiles(recorder.uri);
        return;
      }
      recorder.record();
      recorderActive.current = true;
      setRecording(true);
      recordingTimer.current = setTimeout(() => {
        recordingTimer.current = null;
        void finishQuestion();
      }, MAX_VOICE_RECORDING_MS);
    } catch {
      recorderActive.current = false;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      await discardLocalFiles(recorder.uri);
      if (mounted.current && questionGate.isActive(operation)) {
        setError("The microphone could not start. Check iOS Settings and try again.");
      }
    } finally {
      if (!recorderActive.current) resumeLiveClock();
      if (mounted.current) setPreparingRecording(false);
    }
  };

  const finishQuestion = async () => {
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    recordingTimer.current = null;
    questionGate.cancel();
    if (!recorderActive.current || coachBusy) return;
    recorderActive.current = false;
    setRecording(false);
    setCoachBusy(true);
    let audioUri: string | null = null;
    let frameUri: string | null = null;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      audioUri = recorder.uri;
      if (!audioUri) throw new Error("missing_recording");
      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;
      let responseAudio: string | undefined;
      let responseMime: string | undefined;
      if (awaitingGuidance) {
        const report = await requestGuidance({
          requestId: `report-${Date.now()}`,
          scanId,
          audioUri,
          captures,
          signal: controller.signal,
        });
        if (!mounted.current) return;
        setGuidanceReport(report);
        setCoachCaption(report.summary);
        responseAudio = report.audioBase64;
        responseMime = report.audioMime;
      } else {
        const photo = await takeCameraPhoto(0.5);
        frameUri = photo.uri;
        const response = await askCoach({
          requestId: `turn-${Date.now()}`,
          scanId,
          stage: active,
          imageUri: photo.uri,
          audioUri,
          signal: controller.signal,
        });
        if (!mounted.current) return;
        setCoachCaption(response.text);
        responseAudio = response.audioBase64;
        responseMime = response.audioMime;
      }
      if (responseAudio && !awaitingGuidance) {
        try {
          const audioFile = cacheCoachAudio(responseAudio, responseMime);
          await discardLocalFiles(coachAudioFile.current);
          coachAudioFile.current = audioFile;
          player.replace(audioFile);
          player.play();
        } catch {
          setError("Audio playback is unavailable. Your coach’s answer is shown above.");
        }
      }
      if (awaitingGuidance) router.replace("/recap");
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      if (mounted.current) {
        setError(coachErrorMessage(caught));
      }
    } finally {
      resumeLiveClock();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      await discardLocalFiles(audioUri, frameUri);
      if (mounted.current) setCoachBusy(false);
    }
  };

  const handleVoicePress = () => {
    if (!liveStarted && !liveComplete) return;
    const action = voiceButtonAction({ preparing: preparingRecording, recording, busy: coachBusy });
    if (action === "start") void startQuestion();
    if (action === "finish") void finishQuestion();
  };

  const stopScan = async () => {
    captureGate.cancel();
    questionGate.cancel();
    liveUploadController.current?.abort();
    liveSampler.stop();
    livePausedAt.current = null;
    setLiveStarted(false);
    requestController.current?.abort();
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    recordingTimer.current = null;
    if (recorderActive.current) {
      recorderActive.current = false;
      await recorder.stop().catch(() => undefined);
    }
    pauseAudioSafely(player);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    await resetLiveSession(scanId).catch(() => undefined);
    await discardLocalFiles(recorder.uri, coachAudioFile.current);
    await discardCaptures(captures);
    reset();
    router.replace("/");
  };

  const confirmStop = () => {
    Alert.alert(
      "Stop this scan?",
      "Unsaved photos and the current coach recording will be removed from this iPhone.",
      [
        { text: "Keep scanning", style: "cancel" },
        { text: "Stop and discard", style: "destructive", onPress: () => void stopScan() },
      ],
    );
  };

  const skipGuidance = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_500);
    try {
      await resetLiveSession(scanId, controller.signal);
    } catch {
      // The API also expires abandoned live sessions; skipping should never trap the user here.
    } finally {
      clearTimeout(timeout);
      if (mounted.current) router.replace("/recap");
    }
  };

  if (!permission?.granted) {
    return <SafeAreaView style={styles.blocked}><Text style={styles.blockedTitle}>Camera access was removed.</Text><PrimaryButton label="Return to setup" onPress={() => router.replace("/setup")} /></SafeAreaView>;
  }

  return (
    <View style={styles.page}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture" pictureSize={pictureSize} animateShutter={false} onMountError={() => setError("Camera could not start. Return to setup and check camera access.")} onCameraReady={async () => {
        const sizes = await camera.current?.getAvailablePictureSizesAsync().catch(() => []);
        const bounded = sizes?.filter((size) => { const [w, h] = size.split("x").map(Number); return w! * h! <= 1_500_000; });
        if (bounded?.length) setPictureSize(bounded.sort((a, b) => { const area = (v: string) => v.split("x").map(Number).reduce((x, y) => x * y, 1); return area(b) - area(a); })[0]);
        setCameraReady(true);
      }} />
      <View pointerEvents="none" style={styles.scrimTop} />
      <View pointerEvents="none" style={styles.scrimBottom} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <PrimaryButton label="Stop" variant="ghost" onPress={confirmStop} style={styles.stopButton} />
          <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE CAPTURE</Text></View>
          <View style={styles.stopSpacer} />
        </View>
        <ProgressRail active={active} captures={captures} />

        <View style={styles.instructionCard}>
          <Text style={styles.viewLabel}>{awaitingGuidance ? "FINAL STEP" : liveStarted ? `${livePhase.view.toUpperCase()} PHASE` : "CONTINUOUS SCAN"}</Text>
          <Text style={styles.instruction}>{awaitingGuidance ? "Tap the microphone, describe what feels uncomfortable or what you want help with, then tap again to send." : liveStarted ? livePhase.instruction : "Stand fully in frame, then start one slow turn. Align will sample the live feed automatically."}</Text>
        </View>

        <View pointerEvents="none" style={styles.frameGuide}>
          <View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} />
          <View style={styles.floorMark}><View style={styles.floorLineA} /><View style={styles.floorLineB} /></View>
        </View>

        {liveStarted ? (
          <View pointerEvents="none" style={styles.countdownBubble}>
            <Text style={styles.countdownText}>{Math.floor(livePhase.progress * 100)}%</Text>
            <Text style={styles.liveSampleText}>{liveFrameCount} captured</Text>
          </View>
        ) : null}

        <View style={styles.bottomPanel}>
          {liveStarted && captures[active] ? <View style={styles.captureProof}><Image key={liveFrameCount} source={{ uri: captures[active] }} style={styles.captureThumb} /><Text style={styles.captureProofText}>{localViewsRef.current.size}/4 views retained · {liveFrameCount} photos captured{"\n"}Camera samples, not a posture score</Text></View> : null}
          {coachCaption ? <View style={styles.caption}><Text style={styles.captionLabel}>COACH</Text><Text style={styles.captionText}>{coachCaption}</Text></View> : null}
          {error || captureError ? <Text accessibilityRole="alert" style={styles.error}>{error || captureError}</Text> : null}
          <View style={styles.actionRow}>
            <View style={styles.coachAction}>
              <PrimaryButton
                label={recording ? "Tap to send" : preparingRecording ? "Starting microphone…" : coachBusy ? "Coach is responding…" : awaitingGuidance ? "Tap to describe your goal" : cloudCoachEnabled ? "Tap to ask coach" : "Coach off"}
                variant="secondary"
                disabled={!cloudCoachEnabled || coachBusy || preparingRecording || cameraBusy.current || (!liveStarted && !liveComplete)}
                onPress={handleVoicePress}
                icon={coachBusy || preparingRecording ? <ActivityIndicator color={colors.tealDark} /> : <SymbolView name={recording ? "waveform" : "mic.fill"} size={19} tintColor={recording ? colors.coral : colors.tealDark} />}
              />
            </View>
            {awaitingGuidance ? (
              <PrimaryButton label="Skip guidance" variant="secondary" disabled={preparingRecording || recording || coachBusy} onPress={() => void skipGuidance()} style={styles.captureAction} />
            ) : (
              <PrimaryButton
                label={liveStarted ? `${busy ? "Sampling" : "Scanning"} ${Math.floor(livePhase.progress * 100)}%` : cameraReady ? "Start live scan" : "Starting camera…"}
                disabled={!cameraReady || liveStarted || busy || preparingRecording || recording || coachBusy}
                onPress={startLiveScan}
                style={styles.captureAction}
                icon={liveStarted ? <ActivityIndicator color={colors.white} /> : <SymbolView name="video.fill" size={19} tintColor={colors.white} />}
              />
            )}
          </View>
          <Text style={styles.hint}>{awaitingGuidance ? "Tap once to record your goal, then tap again to send it with the live scan." : liveStarted ? "Rotate slowly. You can tap the coach at any time; live sampling pauses while you speak." : cloudCoachEnabled ? "One live scan replaces four separate photo buttons." : "Local-only mode: frames stay on this iPhone."}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.camera },
  safe: { flex: 1, paddingHorizontal: spacing.md },
  blocked: { flex: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.canvas },
  blockedTitle: { color: colors.ink, fontSize: 26, fontWeight: "700" },
  scrimTop: { position: "absolute", top: 0, left: 0, right: 0, height: "35%", backgroundColor: "rgba(5,10,8,0.44)" },
  scrimBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: "38%", backgroundColor: "rgba(5,10,8,0.7)" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 },
  stopButton: { minHeight: 44, paddingHorizontal: 0, width: 64 },
  stopSpacer: { width: 64 },
  liveBadge: { flexDirection: "row", gap: 7, alignItems: "center", paddingHorizontal: 12, minHeight: 34, borderRadius: radius.pill, backgroundColor: "rgba(10,18,15,0.72)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#62D3B6" },
  liveText: { color: colors.white, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  instructionCard: { alignSelf: "center", marginTop: spacing.md, maxWidth: 330, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: "rgba(10,18,15,0.78)", alignItems: "center", gap: 4 },
  viewLabel: { color: "#8ED8C7", fontSize: 11, letterSpacing: 1.2, fontWeight: "900" },
  instruction: { color: colors.white, fontSize: 17, lineHeight: 22, textAlign: "center", fontWeight: "600" },
  frameGuide: { position: "absolute", top: "28%", left: "20%", right: "20%", bottom: "30%" },
  corner: { position: "absolute", width: 28, height: 28, borderColor: "rgba(255,255,255,0.82)" },
  topLeft: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 10 },
  topRight: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 10 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 10 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 10 },
  floorMark: { position: "absolute", bottom: -8, alignSelf: "center", width: 46, height: 20 },
  floorLineA: { position: "absolute", width: 46, height: 2, top: 9, backgroundColor: "rgba(255,255,255,0.72)", transform: [{ rotate: "12deg" }] },
  floorLineB: { position: "absolute", width: 46, height: 2, top: 9, backgroundColor: "rgba(255,255,255,0.72)", transform: [{ rotate: "-12deg" }] },
  countdownBubble: { position: "absolute", top: "45%", alignSelf: "center", width: 108, height: 108, borderRadius: 54, backgroundColor: "rgba(12,24,20,0.86)", borderWidth: 2, borderColor: "rgba(255,255,255,0.75)", alignItems: "center", justifyContent: "center" },
  countdownText: { color: colors.white, fontSize: 42, fontWeight: "800", letterSpacing: -1 },
  liveSampleText: { color: "#C7CFCC", fontSize: 11, fontWeight: "700" },
  captureProof: { flexDirection: "row", alignItems: "center", gap: 10 },
  captureThumb: { width: 40, height: 52, borderRadius: 6 },
  captureProofText: { color: colors.white, fontSize: 12, lineHeight: 17 },
  bottomPanel: { marginTop: "auto", paddingBottom: spacing.sm, gap: spacing.sm },
  caption: { borderRadius: radius.md, backgroundColor: "rgba(247,250,247,0.94)", padding: spacing.md, gap: 4 },
  captionLabel: { color: colors.tealDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  captionText: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: "500" },
  error: { color: "#FFD3CE", textAlign: "center", fontSize: 13, lineHeight: 18, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  coachAction: { flex: 1 },
  captureAction: { flex: 1.18 },
  hint: { color: "#C7CFCC", textAlign: "center", fontSize: 11, lineHeight: 16, paddingHorizontal: spacing.md },
});
