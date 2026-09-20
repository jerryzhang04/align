import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, AppState, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from "expo-audio";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { StatusBar } from "expo-status-bar";
import type { ViewId } from "@align/contracts";
import { BodyGuide } from "../src/components/BodyGuide";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ProgressRail } from "../src/components/ProgressRail";
import { createLiveFrameSampler } from "../src/lib/liveFrameSampler";
import { holdReadyToCapture, PREVIEW_INTERVAL_MS, scanHint, scanInstruction, scanPhaseLabel, VIEW_LOCK_MS } from "../src/lib/liveScanFlow";
import { OMNI_RECORDING } from "../src/lib/omniRecording";
import { playCachedCoachAudio, prepareCoachPlayback } from "../src/lib/coachPlayback";
import { advanceCapture } from "../src/lib/captureFlow";
import { createOperationGate } from "../src/lib/operationGate";
import { voiceButtonAction } from "../src/lib/voiceInteraction";
import { cacheCoachAudio } from "../src/services/audioFile";
import { mergeMeasurements } from "../src/lib/measurementCopy";
import { localWellnessReport } from "../src/lib/localGuidance";
import { permissionDeniedMessage, recordingErrorMessage } from "../src/lib/recordingError";
import { coachErrorMessage } from "../src/services/request";
import { askCoach, previewStance, requestGuidance } from "../src/services/coach";
import { discardCaptures, discardLocalFiles, persistCapture } from "../src/services/captures";
import { resetLiveSession, uploadLiveFrame } from "../src/services/liveCoach";
import { useScan } from "../src/state/ScanContext";
import { colors, radius, spacing } from "../src/theme";
import { pauseAudioSafely } from "../src/lib/audioLifecycle";
import { createPreviewGate } from "../src/lib/previewGate";

const MAX_VOICE_RECORDING_MS = 15_000;

export default function ScanScreen() {
  const [permission] = useCameraPermissions();
  const camera = useRef<CameraView | null>(null);
  const cameraBusy = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const liveUploadController = useRef<AbortController | null>(null);
  const captureGate = useRef(createOperationGate()).current;
  const questionGate = useRef(createOperationGate()).current;
  const liveSampler = useRef(createLiveFrameSampler({ intervalMs: 0 })).current;
  const holdFillRef = useRef(0);
  const lastTickRef = useRef(0);
  const livePausedAt = useRef<number | null>(null);
  const localViewsRef = useRef(new Set<ViewId>());
  const activeViewRef = useRef<ViewId>("front");
  const viewLockedRef = useRef(false);
  const capturingRef = useRef(false);
  const alignedRef = useRef(false);
  const stillRef = useRef(true);
  const previewBusyRef = useRef(false);
  const previewGate = useRef(createPreviewGate()).current;
  const manualCaptureRequested = useRef(false);
  const autoCaptureRef = useRef(true);
  const foregroundRef = useRef(true);
  const lastPreviewAt = useRef(0);
  const voiceActivityRef = useRef(false);
  const mounted = useRef(true);
  const recorderActive = useRef(false);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coachAudioFile = useRef<string | null>(null);
  const { scanId, captures, cloudCoachEnabled, coachCaption, guidanceReport, measurements, setCapture, setCoachCaption, setGuidanceReport, setMeasurements, reset } = useScan();
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string>();
  const [liveStarted, setLiveStarted] = useState(false);
  const [liveComplete, setLiveComplete] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("front");
  const [holdFillAmount, setHoldFillAmount] = useState(0);
  const [viewLocked, setViewLocked] = useState(false);
  const [stanceHint, setStanceHint] = useState("");
  const [aligned, setAligned] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [preparingRecording, setPreparingRecording] = useState(false);
  const [recording, setRecording] = useState(false);
  const [coachBusy, setCoachBusy] = useState(false);
  const [error, setError] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [awaitingGuidance, setAwaitingGuidance] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [autoCapture, setAutoCapture] = useState(cloudCoachEnabled);
  const [voiceStatus, setVoiceStatus] = useState("");
  const recorder = useAudioRecorder(OMNI_RECORDING);
  const player = useAudioPlayer(null);
  const active = activeView;
  voiceActivityRef.current = preparingRecording || recording || coachBusy;
  activeViewRef.current = activeView;
  autoCaptureRef.current = autoCapture;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      foregroundRef.current = state === "active";
      previewGate.reset();
      holdFillRef.current = 0;
      manualCaptureRequested.current = false;
      lastTickRef.current = Date.now();
      if (state !== "active" && recorderActive.current) {
        recorderActive.current = false;
        if (recordingTimer.current) clearTimeout(recordingTimer.current);
        recordingTimer.current = null;
        setRecording(false);
        setVoiceStatus("");
        setError("Recording paused when you left the app. Return and record your question again.");
        void recorder.stop().then(() => discardLocalFiles(recorder.uri)).catch(() => undefined);
        void prepareCoachPlayback().catch(() => undefined);
        livePausedAt.current = null;
      }
    });
    return () => subscription.remove();
  }, [previewGate, recorder]);

  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    return () => sub.remove();
  }, []);

  const takeCameraPhoto = async (quality: number) => {
    // A pose preview may already own the camera when the user taps Send.
    const deadline = Date.now() + 3_000;
    while (cameraBusy.current && mounted.current && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!mounted.current || !foregroundRef.current) throw new Error("camera_unavailable");
    if (!camera.current || cameraBusy.current) throw new Error("camera_busy");
    cameraBusy.current = true;
    try {
      return await camera.current.takePictureAsync({ quality, shutterSound: false });
    } finally {
      cameraBusy.current = false;
    }
  };

  const pauseLiveClock = () => {
    if (liveStarted && livePausedAt.current === null) livePausedAt.current = Date.now();
  };

  const resumeLiveClock = () => {
    livePausedAt.current = null;
    lastTickRef.current = Date.now();
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
    lastTickRef.current = Date.now();

    const finishScan = () => {
      liveSampler.stop();
      setLiveStarted(false);
      setLiveComplete(true);
      setViewLocked(false);
      viewLockedRef.current = false;
      if (cloudCoachEnabled) setAwaitingGuidance(true);
      else router.replace("/recap");
    };

    const captureView = async (view: ViewId) => {
      if (cancelled || !mounted.current || localViewsRef.current.has(view)) return;
      if (!camera.current || cameraBusy.current || voiceActivityRef.current) return;
      if (!liveSampler.tryStart(Date.now())) return;

      const operation = captureGate.begin();
      let temporaryPhoto: string | undefined;
      let stagedPhoto: string | undefined;
      let stagedRegistered = false;
      let completed = false;
      let uploadController: AbortController | null = null;
      setBusy(true);
      capturingRef.current = true;
      try {
        const photo = await takeCameraPhoto(0.5);
        const capturedAtMs = Date.now();
        temporaryPhoto = photo.uri;
        if (!mounted.current || !captureGate.isActive(operation)) return;
        stagedPhoto = await persistCapture(scanId, view, photo.uri);
        if (!mounted.current || !captureGate.isActive(operation)) return;
        setCapture(view, stagedPhoto);
        stagedRegistered = true;
        localViewsRef.current.add(view);
        completed = true;
        if (cloudCoachEnabled && mounted.current) {
          uploadController = new AbortController();
          liveUploadController.current = uploadController;
          const uploadTimeout = setTimeout(() => uploadController?.abort(), 4_000);
          try {
            await uploadLiveFrame({
              scanId,
              requestId: `frame-${capturedAtMs}`,
              capturedAtMs,
              view,
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
        viewLockedRef.current = true;
        if (mounted.current) {
          setViewLocked(true);
          setHoldFillAmount(1);
        }
        if (!reduceMotion) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        }
        await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 120 : VIEW_LOCK_MS));
        if (!mounted.current) return;
        const next = advanceCapture(view);
        if (next === "complete") {
          finishScan();
          return;
        }
        activeViewRef.current = next;
        previewGate.reset();
        manualCaptureRequested.current = false;
        holdFillRef.current = 0;
        alignedRef.current = !cloudCoachEnabled;
        stillRef.current = true;
        lastPreviewAt.current = 0;
        lastTickRef.current = Date.now();
        viewLockedRef.current = false;
        setActiveView(next);
        setHoldFillAmount(0);
        setViewLocked(false);
        setAligned(!cloudCoachEnabled);
        setStanceHint("");
      } catch {
        if (mounted.current && captureGate.isActive(operation)) {
          setCaptureError("Hold still in the outline. Align will try that view again.");
          holdFillRef.current = 0;
          alignedRef.current = false;
          setAligned(false);
        }
      } finally {
        if (liveUploadController.current === uploadController) liveUploadController.current = null;
        if (completed) liveSampler.markCaptureComplete();
        else liveSampler.markCaptureFailure();
        if (stagedPhoto && !stagedRegistered) await discardLocalFiles(stagedPhoto);
        await discardLocalFiles(temporaryPhoto);
        if (mounted.current) setBusy(false);
        capturingRef.current = false;
      }
    };

    const runPreview = async (view: ViewId) => {
      if (!cloudCoachEnabled || !autoCaptureRef.current || !foregroundRef.current || cancelled || previewBusyRef.current || cameraBusy.current || capturingRef.current) return;
      if (!camera.current || voiceActivityRef.current || viewLockedRef.current) return;
      previewBusyRef.current = true;
      lastPreviewAt.current = Date.now();
      let previewUri: string | undefined;
      const sampledAt = Date.now();
      try {
        const photo = await takeCameraPhoto(0.4);
        previewUri = photo.uri;
        if (cancelled || !mounted.current) return;
        const result = await previewStance({
          requestId: `preview-${Date.now()}`,
          scanId,
          view,
          imageUri: photo.uri,
        });
        if (cancelled || !mounted.current || activeViewRef.current !== view || !autoCaptureRef.current || voiceActivityRef.current) return;
        previewGate.observe(view, sampledAt, result.aligned && result.still, Date.now());
        alignedRef.current = result.aligned;
        stillRef.current = result.still;
        setAligned(result.aligned);
        setStanceHint(result.issues[0]?.message ?? (result.aligned ? "Body found. Hold still while the checks complete." : "Keep your whole body in view."));
      } catch {
        previewGate.reset();
        if (mounted.current && !cancelled) {
          alignedRef.current = false;
          stillRef.current = false;
          setAligned(false);
          setStanceHint("Pose check unavailable. Turn off Auto and capture each view when ready.");
        }
      } finally {
        previewBusyRef.current = false;
        await discardLocalFiles(previewUri);
      }
    };

    const tick = () => {
      if (cancelled) return;
      const now = Date.now();
      const paused = !foregroundRef.current || livePausedAt.current !== null || voiceActivityRef.current || viewLockedRef.current || capturingRef.current;
      const view = activeViewRef.current;
      lastTickRef.current = now;
      if (localViewsRef.current.has(view) && !viewLockedRef.current && !cameraBusy.current && !liveSampler.isInFlight()) {
        const next = advanceCapture(view);
        if (next === "complete") {
          finishScan();
          return;
        }
        activeViewRef.current = next;
        previewGate.reset();
        manualCaptureRequested.current = false;
        holdFillRef.current = 0;
        alignedRef.current = !cloudCoachEnabled;
        stillRef.current = true;
        viewLockedRef.current = false;
        if (mounted.current) {
          setActiveView(next);
          setHoldFillAmount(0);
          setViewLocked(false);
          setAligned(!cloudCoachEnabled);
          setStanceHint("");
        }
        return;
      }
      const canFill = cloudCoachEnabled && autoCaptureRef.current && previewGate.ready(view, now);
      if (!paused) {
        holdFillRef.current = autoCaptureRef.current ? previewGate.progress(view, now) : 0;
      }
      const fill = holdFillRef.current;
      if (mounted.current) setHoldFillAmount(viewLockedRef.current ? 1 : fill);
      if (!paused && !canFill && !manualCaptureRequested.current && cloudCoachEnabled && autoCaptureRef.current && now - lastPreviewAt.current >= PREVIEW_INTERVAL_MS) {
        void runPreview(view);
      }
      if (!paused && (holdReadyToCapture(fill, localViewsRef.current.has(view), canFill) || manualCaptureRequested.current)) {
        void captureView(view);
      }
    };

    const timer = setInterval(tick, 50);
    tick();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [captureGate, cloudCoachEnabled, liveComplete, liveSampler, liveStarted, reduceMotion, scanId, setCapture, previewGate]);

  const startLiveScan = () => {
    if (!cameraReady || !camera.current || cameraBusy.current || liveStarted) return;
    captureGate.cancel();
    liveSampler.reset();
    previewGate.reset();
    manualCaptureRequested.current = false;
    holdFillRef.current = 0;
    lastTickRef.current = Date.now();
    livePausedAt.current = null;
    localViewsRef.current = new Set();
    activeViewRef.current = "front";
    viewLockedRef.current = false;
    capturingRef.current = false;
    alignedRef.current = !cloudCoachEnabled;
    stillRef.current = true;
    lastPreviewAt.current = 0;
    setActiveView("front");
    setHoldFillAmount(0);
    setViewLocked(false);
    setAligned(!cloudCoachEnabled);
    setStanceHint("");
    setLiveComplete(false);
    setAwaitingGuidance(false);
    setError("");
    setCaptureError("");
    setLiveStarted(true);
  };

  const startQuestion = async () => {
    if (!cloudCoachEnabled || coachBusy || preparingRecording || recording || capturingRef.current) return;
    const operation = questionGate.begin();
    if (liveStarted) pauseLiveClock();
    voiceActivityRef.current = true;
    setPreparingRecording(true);
    try {
      setError("");
      setVoiceStatus("");
      previewGate.reset();
      holdFillRef.current = 0;
      pauseAudioSafely(player);
      const previousAudio = coachAudioFile.current;
      coachAudioFile.current = null;
      await discardLocalFiles(previousAudio);
      const microphone = await requestRecordingPermissionsAsync();
      if (!mounted.current || !questionGate.isActive(operation)) return;
      if (!microphone.granted) {
        setError(permissionDeniedMessage(false));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: "doNotMix", shouldRouteThroughEarpiece: false });
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (!mounted.current || !questionGate.isActive(operation)) {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        return;
      }
      // Recreate the file for each turn; the previous recording was deleted.
      await recorder.prepareToRecordAsync(OMNI_RECORDING);
      if (!mounted.current || !questionGate.isActive(operation)) {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        await discardLocalFiles(recorder.uri);
        return;
      }
      recorder.record();
      recorderActive.current = true;
      setRecording(true);
      setVoiceStatus("Listening · tap Send when you finish (15 seconds maximum)");
      recordingTimer.current = setTimeout(() => {
        recordingTimer.current = null;
        void finishQuestion();
      }, MAX_VOICE_RECORDING_MS);
    } catch (caught) {
      recorderActive.current = false;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      await discardLocalFiles(recorder.uri);
      if (mounted.current && questionGate.isActive(operation)) {
        setError(recordingErrorMessage(caught));
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
    voiceActivityRef.current = true;
    setVoiceStatus("Sending your question…");
    let audioUri: string | null = null;
    let frameUri: string | null = null;
    try {
      await recorder.stop();
      await prepareCoachPlayback();
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
        setMeasurements((current) => mergeMeasurements(current, report.measurements ?? []));
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
        setMeasurements((current) => mergeMeasurements(current, response.measurements ?? []));
        responseAudio = response.audioBase64;
        responseMime = response.audioMime;
      }
      // Recap owns final-report playback. Starting here then navigating would
      // release this player in the middle of its first words.
      if (responseAudio && !awaitingGuidance) {
        try {
          const audioFile = cacheCoachAudio(responseAudio, responseMime ?? "audio/wav");
          await discardLocalFiles(coachAudioFile.current);
          coachAudioFile.current = audioFile;
          await playCachedCoachAudio(player, audioFile);
          setVoiceStatus("Coach audio ready · replay below");
        } catch {
          setError("Audio playback is unavailable. Your coach’s answer is shown above.");
        }
      }
      if (!responseAudio) setVoiceStatus("This reply has captions only. OMNI did not return audio.");
      if (awaitingGuidance) router.replace("/recap");
    } catch (caught) {
      if (!mounted.current) return;
      setError(coachErrorMessage(caught));
      setVoiceStatus("");
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
    const stopController = new AbortController();
    const stopTimeout = setTimeout(() => stopController.abort(), 2_500);
    try {
      await resetLiveSession(scanId, stopController.signal).catch(() => undefined);
    } finally {
      clearTimeout(stopTimeout);
    }
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
    setMeasuring(true);
    setError("");
    try {
      let nextMeasurements = measurements;
      if (cloudCoachEnabled && captures.front && captures.right && captures.back && captures.left) {
        const measureController = new AbortController();
        const measureTimeout = setTimeout(() => measureController.abort(), 65_000);
        try {
          const report = await requestGuidance({
            requestId: `analysis-${Date.now()}`,
            scanId,
            captures,
            signal: measureController.signal,
          });
          nextMeasurements = report.measurements ?? [];
          if (mounted.current) {
            setMeasurements(nextMeasurements);
            setGuidanceReport(report);
          }
        } catch (caught) {
          if (mounted.current) setError(coachErrorMessage(caught));
          return;
        } finally {
          clearTimeout(measureTimeout);
        }
      }
      if (mounted.current && !cloudCoachEnabled && !guidanceReport) {
        setGuidanceReport(localWellnessReport({
          requestId: `local-${Date.now()}`,
          measurements: nextMeasurements,
        }));
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2_500);
      try {
        await resetLiveSession(scanId, controller.signal);
      } catch {
        // The API also expires abandoned live sessions; skipping should never trap the user here.
      } finally {
        clearTimeout(timeout);
      }
      if (mounted.current) router.replace("/recap");
    } finally {
      if (mounted.current) setMeasuring(false);
    }
  };

  if (!permission?.granted) {
    return <SafeAreaView style={styles.blocked}><Text style={styles.blockedTitle}>Camera access was removed.</Text><PrimaryButton label="Return to setup" onPress={() => router.replace("/setup")} /></SafeAreaView>;
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture" mute pictureSize={pictureSize} animateShutter={false} onMountError={() => setError("Camera could not start. Return to setup and check camera access.")} onCameraReady={async () => {
        const sizes = await camera.current?.getAvailablePictureSizesAsync().catch(() => []);
        const bounded = sizes?.filter((size) => { const [w, h] = size.split("x").map(Number); return w! * h! <= 1_500_000; });
        if (bounded?.length) setPictureSize(bounded.sort((a, b) => { const area = (v: string) => v.split("x").map(Number).reduce((x, y) => x * y, 1); return area(b) - area(a); })[0]);
        setCameraReady(true);
      }} />
      <View pointerEvents="none" style={styles.scrimTop} />
      <View pointerEvents="none" style={styles.scrimBottom} />
      {!awaitingGuidance ? (
        <View pointerEvents="none" style={styles.bodyGuideWrap}>
          <BodyGuide view={active} fill={liveStarted ? holdFillAmount : 0} locked={viewLocked} />
        </View>
      ) : null}

      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <PrimaryButton label="Stop" onPress={confirmStop} style={styles.stopButton} />
          <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>{viewLocked ? "SAVED" : liveStarted ? (aligned || !cloudCoachEnabled ? "HOLD STILL" : "LINE UP") : "LINE UP"}</Text></View>
          <View style={styles.stopSpacer} />
        </View>
        <ProgressRail active={active} captures={captures} />

        <View style={styles.instructionCard}>
          <Text style={styles.viewLabel}>{awaitingGuidance ? "SCAN COMPLETE" : liveStarted ? scanPhaseLabel(active, true, false) : "FULL-BODY SCAN"}</Text>
          <Text style={styles.instruction}>{awaitingGuidance ? "Your four photos are ready. Analyze them now, or add a spoken question for the coach." : scanInstruction(active, liveStarted, liveStarted && autoCapture ? stanceHint : "")}</Text>
        </View>

        <View style={styles.bottomPanel}>
          {coachCaption ? <View style={styles.caption}><Text style={styles.captionLabel}>COACH</Text><Text style={styles.captionText}>{coachCaption}</Text></View> : null}
          {error || captureError ? <Text accessibilityRole="alert" style={styles.error}>{error || captureError}</Text> : null}
          {voiceStatus ? <Text accessibilityLiveRegion="polite" style={styles.hint}>{voiceStatus}</Text> : null}
          {coachAudioFile.current && !recording && !coachBusy && !awaitingGuidance ? <PrimaryButton label="Replay coach" variant="secondary" onPress={() => { void playCachedCoachAudio(player, coachAudioFile.current!).catch(() => setError("Could not play audio. Read the coach caption above.")); }} /> : null}
          {!awaitingGuidance && cloudCoachEnabled ? <View style={styles.modeRow}>
            <Text style={styles.modeText}>{autoCapture ? `Auto · ${Math.round(holdFillAmount * 3)}/3 steady checks` : "Manual · capture when your angle is ready"}</Text>
            <Switch accessibilityLabel="Automatic capture" value={autoCapture} disabled={busy || recording || coachBusy} onValueChange={(enabled) => { autoCaptureRef.current = enabled; setAutoCapture(enabled); previewGate.reset(); holdFillRef.current = 0; manualCaptureRequested.current = false; setStanceHint(""); }} />
          </View> : null}
          <View style={styles.actionRow}>
            <View style={styles.coachAction}>
              <PrimaryButton
                label={recording ? "Send question" : preparingRecording ? "Starting mic…" : coachBusy ? "Waiting for coach…" : awaitingGuidance ? "Add a question" : cloudCoachEnabled ? "Ask coach" : "Coach off"}
                variant="secondary"
                disabled={!cloudCoachEnabled || coachBusy || preparingRecording || measuring || busy || (!liveStarted && !liveComplete)}
                onPress={handleVoicePress}
                icon={coachBusy || preparingRecording ? <ActivityIndicator color={colors.tealDark} /> : <SymbolView name={recording ? "waveform" : "mic.fill"} size={19} tintColor={recording ? colors.coral : colors.tealDark} />}
              />
            </View>
            {awaitingGuidance ? (
              <PrimaryButton label={measuring ? "Analyzing photos…" : "Analyze posture"} disabled={preparingRecording || recording || coachBusy || measuring} onPress={() => void skipGuidance()} style={styles.captureAction} />
            ) : (
              <PrimaryButton
                label={!cameraReady ? "Starting camera…" : !liveStarted ? "Start scan" : busy ? "Saving photo…" : viewLocked ? "Photo saved" : `Capture ${active} now`}
                disabled={!cameraReady || viewLocked || busy || preparingRecording || recording || coachBusy || measuring}
                onPress={() => { if (!liveStarted) startLiveScan(); else manualCaptureRequested.current = true; }}
                style={styles.captureAction}
                icon={busy ? <ActivityIndicator color={colors.white} /> : <SymbolView name="camera.fill" size={19} tintColor={colors.white} />}
              />
            )}
          </View>
          <Text style={styles.hint}>{liveStarted && !autoCapture ? "Show your head and both feet. Check the named view before capturing. Manual capture does not verify your angle." : scanHint(liveStarted, awaitingGuidance, cloudCoachEnabled)}</Text>
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
  scrimTop: { position: "absolute", top: 0, left: 0, right: 0, height: "18%", backgroundColor: "rgba(5,10,8,0.38)" },
  scrimBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: "24%", backgroundColor: "rgba(5,10,8,0.62)" },
  bodyGuideWrap: { position: "absolute", top: "29%", height: "43%", width: "60%", left: "20%" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 },
  stopButton: { minHeight: 44, paddingHorizontal: 0, width: 64, backgroundColor: "transparent" },
  stopSpacer: { width: 64 },
  liveBadge: { flexDirection: "row", gap: 7, alignItems: "center", paddingHorizontal: 12, minHeight: 34, borderRadius: radius.pill, backgroundColor: "rgba(10,18,15,0.72)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#62D3B6" },
  liveText: { color: colors.white, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  instructionCard: { alignSelf: "center", marginTop: spacing.md, maxWidth: 330, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: "rgba(10,18,15,0.78)", alignItems: "center", gap: 4 },
  viewLabel: { color: "#8ED8C7", fontSize: 11, letterSpacing: 1.2, fontWeight: "900" },
  instruction: { color: colors.white, fontSize: 17, lineHeight: 22, textAlign: "center", fontWeight: "600" },
  bottomPanel: { marginTop: "auto", paddingBottom: spacing.sm, gap: spacing.sm },
  caption: { borderRadius: radius.md, backgroundColor: "rgba(247,250,247,0.94)", padding: spacing.md, gap: 4 },
  captionLabel: { color: colors.tealDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  captionText: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: "500" },
  error: { color: "#FFD3CE", textAlign: "center", fontSize: 13, lineHeight: 18, fontWeight: "600" },
  modeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  modeText: { flex: 1, color: colors.white, fontSize: 13, fontWeight: "600" },
  actionRow: { gap: spacing.sm },
  coachAction: {},
  captureAction: {},
  hint: { color: "#C7CFCC", textAlign: "center", fontSize: 11, lineHeight: 16, paddingHorizontal: spacing.md },
});
