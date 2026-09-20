import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ViewId } from "@align/contracts";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ProgressRail } from "../src/components/ProgressRail";
import { CAPTURE_VIEWS, advanceCapture } from "../src/lib/captureFlow";
import { createOperationGate } from "../src/lib/operationGate";
import { cacheCoachAudio } from "../src/services/audioFile";
import { askCoach, requestGuidance } from "../src/services/coach";
import { discardCaptures, discardLocalFiles, persistCapture } from "../src/services/captures";
import { useScan } from "../src/state/ScanContext";
import { colors, radius, spacing } from "../src/theme";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export default function ScanScreen() {
  const params = useLocalSearchParams<{ retake?: ViewId }>();
  const [permission] = useCameraPermissions();
  const camera = useRef<CameraView | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const captureGate = useRef(createOperationGate()).current;
  const questionGate = useRef(createOperationGate()).current;
  const mounted = useRef(true);
  const recorderActive = useRef(false);
  const coachAudioFile = useRef<string | null>(null);
  const { scanId, captures, cloudCoachEnabled, coachCaption, setCapture, setCoachCaption, setGuidanceReport, reset } = useScan();
  const firstMissing = CAPTURE_VIEWS.find((view) => !captures[view.id])?.id ?? params.retake ?? "front";
  const [active, setActive] = useState<ViewId>(firstMissing);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [coachBusy, setCoachBusy] = useState(false);
  const [error, setError] = useState("");
  const [awaitingGuidance, setAwaitingGuidance] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(null);

  const activeView = useMemo(() => CAPTURE_VIEWS.find((view) => view.id === active) ?? CAPTURE_VIEWS[0]!, [active]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      captureGate.cancel();
      questionGate.cancel();
      requestController.current?.abort();
      player.pause();
      if (recorderActive.current) {
        recorderActive.current = false;
        void recorder.stop().catch(() => undefined).finally(() => {
          void discardLocalFiles(recorder.uri);
          void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        });
      }
      void discardLocalFiles(coachAudioFile.current);
    };
  }, [captureGate, player, questionGate, recorder]);

  const captureView = async () => {
    if (!camera.current || busy) return;
    const operation = captureGate.begin();
    let temporaryPhoto: string | undefined;
    let stagedPhoto: string | undefined;
    setBusy(true);
    setError("");
    try {
      for (let tick = 3; tick >= 1; tick -= 1) {
        setCountdown(tick);
        await wait(700);
        if (!mounted.current || !captureGate.isActive(operation)) return;
      }
      setCountdown(0);
      const photo = await camera.current.takePictureAsync({ quality: 0.72, shutterSound: false });
      temporaryPhoto = photo.uri;
      if (!mounted.current || !captureGate.isActive(operation)) return;
      stagedPhoto = await persistCapture(scanId, active, photo.uri);
      if (!mounted.current || !captureGate.isActive(operation)) {
        await discardLocalFiles(stagedPhoto);
        return;
      }
      setCapture(active, stagedPhoto);
      const next = advanceCapture(active);
      if (next === "complete") {
        if (cloudCoachEnabled) setAwaitingGuidance(true);
        else router.replace("/recap");
      } else {
        setActive(next);
      }
    } catch {
      if (mounted.current && captureGate.isActive(operation)) {
        setError("That view did not save. Keep the phone still and try again.");
      }
    } finally {
      await discardLocalFiles(temporaryPhoto);
      if (mounted.current) {
        setCountdown(null);
        setBusy(false);
      }
    }
  };

  const startQuestion = async () => {
    if (!cloudCoachEnabled || coachBusy) return;
    const operation = questionGate.begin();
    try {
      setError("");
      player.pause();
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
      recorder.record({ forDuration: 15 });
      recorderActive.current = true;
      setRecording(true);
    } catch {
      recorderActive.current = false;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      await discardLocalFiles(recorder.uri);
      if (mounted.current && questionGate.isActive(operation)) {
        setError("The microphone could not start. Check iOS Settings and try again.");
      }
    }
  };

  const finishQuestion = async () => {
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
          captures,
          audioUri,
          signal: controller.signal,
        });
        if (!mounted.current) return;
        setGuidanceReport(report);
        setCoachCaption(report.summary);
        responseAudio = report.audioBase64;
        responseMime = report.audioMime;
      } else {
        if (!camera.current) throw new Error("missing_camera");
        const photo = await camera.current.takePictureAsync({ quality: 0.5, shutterSound: false });
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
        const audioFile = cacheCoachAudio(responseAudio, responseMime);
        await discardLocalFiles(coachAudioFile.current);
        coachAudioFile.current = audioFile;
        player.replace(audioFile);
        player.play();
      }
      if (awaitingGuidance) router.replace("/recap");
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      if (mounted.current) {
        setError("The coach could not answer. Your scan is still safe—check the server and try again.");
      }
    } finally {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      await discardLocalFiles(audioUri, frameUri);
      if (mounted.current) setCoachBusy(false);
    }
  };

  const stopScan = async () => {
    captureGate.cancel();
    questionGate.cancel();
    requestController.current?.abort();
    if (recorderActive.current) {
      recorderActive.current = false;
      await recorder.stop().catch(() => undefined);
    }
    player.pause();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
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

  if (!permission?.granted) {
    return <SafeAreaView style={styles.blocked}><Text style={styles.blockedTitle}>Camera access was removed.</Text><PrimaryButton label="Return to setup" onPress={() => router.replace("/setup")} /></SafeAreaView>;
  }

  return (
    <View style={styles.page}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture" animateShutter={false} />
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
          <Text style={styles.viewLabel}>{awaitingGuidance ? "FINAL STEP" : `${activeView.label.toUpperCase()} VIEW`}</Text>
          <Text style={styles.instruction}>{awaitingGuidance ? "Hold the microphone and describe what feels uncomfortable or what you want help with." : activeView.instruction}</Text>
        </View>

        <View pointerEvents="none" style={styles.frameGuide}>
          <View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} />
          <View style={styles.floorMark}><View style={styles.floorLineA} /><View style={styles.floorLineB} /></View>
        </View>

        {countdown !== null ? (
          <View pointerEvents="none" style={styles.countdownBubble}>
            <Text style={styles.countdownText}>{countdown === 0 ? "HOLD" : countdown}</Text>
          </View>
        ) : null}

        <View style={styles.bottomPanel}>
          {coachCaption ? <View style={styles.caption}><Text style={styles.captionLabel}>COACH</Text><Text style={styles.captionText}>{coachCaption}</Text></View> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <View style={styles.actionRow}>
            <View style={styles.coachAction}>
              <PrimaryButton
                label={recording ? "Listening… release" : coachBusy ? "Reviewing four views…" : awaitingGuidance ? "Hold to describe your goal" : cloudCoachEnabled ? "Hold to ask" : "Coach off"}
                variant="secondary"
                disabled={!cloudCoachEnabled || coachBusy}
                onPressIn={startQuestion}
                onPressOut={finishQuestion}
                icon={coachBusy ? <ActivityIndicator color={colors.tealDark} /> : <SymbolView name={recording ? "waveform" : "mic.fill"} size={19} tintColor={recording ? colors.coral : colors.tealDark} />}
              />
            </View>
            {awaitingGuidance ? (
              <PrimaryButton label="Skip guidance" variant="secondary" disabled={recording || coachBusy} onPress={() => router.replace("/recap")} style={styles.captureAction} />
            ) : (
              <PrimaryButton
                label={busy ? "Capturing…" : `Capture ${activeView.label}`}
                disabled={busy || recording || coachBusy}
                onPress={captureView}
                style={styles.captureAction}
                icon={<SymbolView name="camera.fill" size={19} tintColor={colors.white} />}
              />
            )}
          </View>
          <Text style={styles.hint}>{awaitingGuidance ? "Your four captured views and this recording are reviewed together." : cloudCoachEnabled ? "Hold Ask coach, speak, then release. The current frame goes with your question." : "Local-only mode: no frame or audio leaves this iPhone."}</Text>
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
