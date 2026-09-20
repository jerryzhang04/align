import { useEffect, useMemo, useRef, useState } from "react";
import type { Measurement, ViewId } from "@align/contracts";
import {
  aggregateMeasurements,
  DEFAULT_HOLD,
  fitBodyGuide,
  holdProgress,
  motionScore,
  nextHoldPhase,
  practiceProfile,
  type PoseFrame,
  type ViewPhase,
} from "@align/metrics";
import { PoseOverlay } from "./components/PoseOverlay";
import { listCameras, openCamera, stopStream, type CameraDevice } from "./lib/camera";
import { sendCoachTurn, fetchHealth, playBase64Audio } from "./lib/coach";
import { captureJpeg } from "./lib/frame";
import { detectPose, getPoseLandmarker } from "./lib/pose";
import { clearScans, loadScans, saveScan, type SavedScan } from "./lib/storage";
import { recordPushToTalk } from "./lib/wav";

type Screen = "home" | "consent" | "setup" | "capture" | "results" | "history";
const VIEWS: ViewId[] = ["front", "right", "back", "left"];
const VIEW_COPY: Record<ViewId, string> = {
  front: "Stand facing the camera. Hair to shoes in frame.",
  right: "Turn right 90 degrees. Keep your feet on the mark.",
  back: "Turn so your back faces the camera.",
  left: "Turn left 90 degrees. Hold still when the bar fills.",
};

function formatValue(item: Measurement): string {
  if (item.unit === "deg") return `${item.value.toFixed(1)}°`;
  if (item.unit === "seconds") return `${item.value.toFixed(1)} s`;
  return item.value.toFixed(3);
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<PoseFrame[]>([]);
  const prevFrameRef = useRef<PoseFrame | null>(null);
  const viewStartedAt = useRef(0);
  const collectStartedAt = useRef<number | null>(null);
  const settleStartedAt = useRef<number | null>(null);
  const coachAbort = useRef<AbortController | null>(null);
  const recorderRef = useRef<ReturnType<typeof recordPushToTalk> | null>(null);
  const acceptedRef = useRef(0);

  const [screen, setScreen] = useState<Screen>("home");
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [cameraId, setCameraId] = useState<string>("");
  const [cameraError, setCameraError] = useState<string>("");
  const [cloudOk, setCloudOk] = useState(false);
  const [allowCloud, setAllowCloud] = useState(true);
  const [frame, setFrame] = useState<PoseFrame | null>(null);
  const [view, setView] = useState<ViewId>("front");
  const [phase, setPhase] = useState<ViewPhase>("coaching");
  const [issue, setIssue] = useState("Step into the silhouette.");
  const [holdAmount, setHoldAmount] = useState(0);
  const [byView, setByView] = useState<Partial<Record<ViewId, Measurement[]>>>({});
  const [saved, setSaved] = useState<SavedScan | null>(null);
  const [history, setHistory] = useState<SavedScan[]>([]);
  const [coachText, setCoachText] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });
  const cameraOn = screen === "setup" || screen === "capture" || screen === "results";

  const measurements = useMemo(() => VIEWS.flatMap((item) => byView[item] ?? []), [byView]);
  const scores = useMemo(() => practiceProfile(measurements), [measurements]);

  useEffect(() => {
    setHistory(loadScans());
    fetchHealth()
      .then((health) => setCloudOk(health.omniConfigured))
      .catch(() => setCloudOk(false));
  }, []);

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    let raf = 0;
    (async () => {
      try {
        setCameraError("");
        const devices = await listCameras();
        if (!cancelled) setCameras(devices);
        const stream = await openCamera(cameraId || undefined);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const labeled = await listCameras();
        if (!cancelled) setCameras(labeled);
        const landmarker = await getPoseLandmarker();
        let lastUi = 0;
        const loop = () => {
          const video = videoRef.current;
          if (cancelled || !video || video.readyState < 2) {
            raf = requestAnimationFrame(loop);
            return;
          }
          const detected = detectPose(landmarker, video, performance.now());
          const now = performance.now();
          if (now - lastUi > 50) {
            lastUi = now;
            if (video.videoWidth) {
              setVideoSize({ width: video.videoWidth, height: video.videoHeight });
            }
            setFrame(detected);
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (error) {
        if (!cancelled) setCameraError(error instanceof Error ? error.message : "Camera permission is required.");
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [cameraOn, cameraId]);

  useEffect(() => {
    if (screen !== "capture" || !frame) return;
    const quality = fitBodyGuide(frame, view);
    const motion = motionScore(prevFrameRef.current, frame);
    prevFrameRef.current = frame;
    const now = performance.now();
    if (!viewStartedAt.current) viewStartedAt.current = now;
    const next = nextHoldPhase({
      now,
      viewStartedAt: viewStartedAt.current,
      qualityOk: quality.ok,
      motion,
      accepted: acceptedRef.current,
      collectStartedAt: collectStartedAt.current,
      settleStartedAt: settleStartedAt.current,
    });
    collectStartedAt.current = next.collectStartedAt;
    settleStartedAt.current = next.settleStartedAt;
    setPhase(next.phase);
    const elapsed = next.phase === "collecting" && next.collectStartedAt ? now - next.collectStartedAt : 0;
    setHoldAmount(holdProgress(next.phase, elapsed, DEFAULT_HOLD.collectMs));
    setIssue(quality.issues[0]?.message ?? (next.phase === "collecting" ? "Hold still in the outline." : VIEW_COPY[view]));
    if (next.phase === "collecting" || next.accept) {
      framesRef.current = [...framesRef.current, frame].slice(-40);
      acceptedRef.current += 1;
    }
    if (next.accept) {
      const measured = aggregateMeasurements(framesRef.current, view);
      setByView((current) => ({ ...current, [view]: measured }));
      const index = VIEWS.indexOf(view);
      framesRef.current = [];
      acceptedRef.current = 0;
      collectStartedAt.current = null;
      settleStartedAt.current = null;
      viewStartedAt.current = performance.now();
      if (index < VIEWS.length - 1) {
        setView(VIEWS[index + 1]);
        setPhase("coaching");
      } else {
        setScreen("results");
      }
    }
    if (next.phase === "retry") {
      framesRef.current = [];
      acceptedRef.current = 0;
      collectStartedAt.current = null;
      settleStartedAt.current = null;
      viewStartedAt.current = performance.now();
      setIssue("Let's retry this view. Reset your stance and hold still.");
    }
  }, [frame, screen, view]);

  function startScan() {
    setByView({});
    setSaved(null);
    setView("front");
    setPhase("coaching");
    setHoldAmount(0);
    acceptedRef.current = 0;
    framesRef.current = [];
    viewStartedAt.current = 0;
    collectStartedAt.current = null;
    settleStartedAt.current = null;
    setCoachText("");
    setScreen("capture");
  }

  function persist() {
    const scan = saveScan({
      views: VIEWS.filter((item) => byView[item]?.length),
      measurements,
      notes: [],
    });
    setSaved(scan);
    setHistory(loadScans());
  }

  async function toggleTalk() {
    if (recording) {
      setRecording(false);
      setBusy(true);
      try {
        const audio = await recorderRef.current?.stop();
        recorderRef.current = null;
        const video = videoRef.current;
        if (!audio || !video) throw new Error("missing_media");
        const image = await captureJpeg(video);
        coachAbort.current?.abort();
        const controller = new AbortController();
        coachAbort.current = controller;
        const response = await sendCoachTurn({
          meta: {
            requestId: crypto.randomUUID(),
            scanId: saved?.id ?? "live",
            stage: screen === "capture" ? `capture:${view}` : screen,
            measurements,
            captureNotes: [issue, `view=${view}`, `phase=${phase}`],
          },
          image,
          audio,
          signal: controller.signal,
        });
        setCoachText(response.text);
        if (response.audioBase64) {
          await playBase64Audio(response.audioBase64, response.audioMime);
        }
      } catch (error) {
        setCoachText(error instanceof Error ? error.message.replaceAll("_", " ") : "Coaching failed.");
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      recorderRef.current = recordPushToTalk();
      setRecording(true);
      setCoachText("Listening…");
    } catch {
      setCoachText("Microphone permission is required for OMNI coaching.");
    }
  }

  const progress = holdAmount;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Align</div>
        <div className="muted small">Web capture · local pose · OMNI coaching</div>
      </header>

      {screen === "home" && (
        <section className="panel stack">
          <h1>Posture scan</h1>
          <p>
            Use any camera this computer or phone can share. Pose stays on the device. Spoken coaching uses OMNI only.
            Chrome or Edge on Windows and Mac is the supported target.
          </p>
          <div className="row">
            <button className="btn" onClick={() => setScreen("consent")}>
              Start scan
            </button>
            <button className="btn secondary" onClick={() => setScreen("history")}>
              History
            </button>
          </div>
          {history[0] && (
            <p className="small">
              Last saved {new Date(history[0].createdAt).toLocaleString()} · {history[0].measurements.length} measurements
            </p>
          )}
        </section>
      )}

      {screen === "consent" && (
        <section className="panel stack">
          <h1>Consent</h1>
          <p>Pose estimation runs locally in this browser. Frames used for overlay are not uploaded for that live skeleton.</p>
          <p>
            If you ask the coach a question, this app sends one selected image, a short audio clip, and the already computed
            measurements to OMNI. You can still complete a scan without that. Guidance is everyday good practice from your photos.
          </p>
          <label className="row">
            <input type="checkbox" checked={allowCloud} onChange={(event) => setAllowCloud(event.target.checked)} />
            Allow OMNI coaching for this session
          </label>
          {!cloudOk && <p className="warn-text">OMNI is not configured on the server yet. Local capture still works.</p>}
          <div className="row">
            <button className="btn secondary" onClick={() => setScreen("home")}>
              Back
            </button>
            <button className="btn" onClick={() => setScreen("setup")}>
              Continue
            </button>
          </div>
        </section>
      )}

      {(screen === "setup" || screen === "capture" || screen === "results") && (
        <section className="panel stack">
          {screen === "setup" && (
            <>
              <h1>Set the camera</h1>
              <p>Place the device so the lens is roughly hip height and the whole body fits. A tape mark on the floor helps repeat standing position. It is not a calibration target.</p>
              <label>
                Camera
                <select value={cameraId} onChange={(event) => setCameraId(event.target.value)}>
                  <option value="">Default camera</option>
                  {cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {cameraError && <p className="warn-text">{cameraError}</p>}
          <div className="stage">
            <video ref={videoRef} playsInline muted autoPlay />
            <PoseOverlay frame={frame} width={videoSize.width} height={videoSize.height} />
            {screen === "capture" && (
              <div className="hud">
                <strong>{view.toUpperCase()}</strong>
                <span>{issue}</span>
                <div className="progress" aria-label="Hold progress">
                  <span style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
          {screen === "setup" && (
            <div className="row">
              <button className="btn secondary" onClick={() => setScreen("consent")}>
                Back
              </button>
              <button className="btn" onClick={startScan} disabled={Boolean(cameraError)}>
                Begin four views
              </button>
            </div>
          )}
          {screen === "capture" && (
            <div className="row">
              <button className="btn secondary" onClick={() => setScreen("setup")}>
                Stop
              </button>
              {allowCloud && (
                <button className="btn" onClick={() => void toggleTalk()} disabled={busy}>
                  {recording ? "Stop and ask OMNI" : busy ? "Waiting on OMNI" : "Push to talk"}
                </button>
              )}
            </div>
          )}
          {coachText && <div className="transcript">{coachText}</div>}
        </section>
      )}

      {screen === "results" && (
        <section className="panel stack">
          <h1>Camera alignment practice</h1>
          <p>These are projected camera measurements and 0–100 practice scores from the metric engine, not a clinical grade.</p>
          {scores.areas.length > 0 && (
            <div className="grid-2">
              <article className="card">
                <b>Overall practice</b>
                <div>{scores.overall}/100</div>
                <p className="small">Everyday camera-alignment practice from your four holds.</p>
              </article>
              {scores.areas.map((area) => (
                <article className="card" key={area.id}>
                  <b>{area.label} · {area.view}</b>
                  <div>{area.score}/100</div>
                  <p className="small">{area.improve}</p>
                  <p className="small">{area.whyCommon}</p>
                </article>
              ))}
            </div>
          )}
          <div className="grid-2">
            {measurements.length === 0 && <p>No supported measurements were retained. Retry a view with a steadier hold.</p>}
            {measurements.map((item) => (
              <article className="card" key={`${item.view}-${item.id}`}>
                <b>
                  {item.id.replaceAll("_", " ")} · {item.view}
                </b>
                <div>{formatValue(item)}</div>
                <div className={item.quality === "usable" ? "ok-text small" : "warn-text small"}>{item.quality}</div>
                <p className="small">{item.limitations.join(" ")}</p>
              </article>
            ))}
          </div>
          <div className="row">
            <button className="btn" onClick={persist}>
              Save locally
            </button>
            <button className="btn secondary" onClick={startScan}>
              Scan again
            </button>
            <button className="btn secondary" onClick={() => setScreen("home")}>
              Home
            </button>
            {allowCloud && (
              <button className="btn" onClick={() => void toggleTalk()} disabled={busy || !videoRef.current}>
                {recording ? "Stop and ask OMNI" : "Ask what this means"}
              </button>
            )}
          </div>
          {saved && <p className="small">Saved {new Date(saved.createdAt).toLocaleString()}</p>}
        </section>
      )}

      {screen === "history" && (
        <section className="panel stack">
          <h1>History</h1>
          {history.length === 0 && <p>No scans saved in this browser yet.</p>}
          {history.map((scan) => (
            <article className="card" key={scan.id}>
              <b>{new Date(scan.createdAt).toLocaleString()}</b>
              <p className="small">
                {scan.measurements.length} measurements · protocol {scan.protocolVersion}
              </p>
            </article>
          ))}
          <div className="row">
            <button className="btn secondary" onClick={() => setScreen("home")}>
              Home
            </button>
            {history.length > 0 && (
              <button
                className="btn warn"
                onClick={() => {
                  clearScans();
                  setHistory([]);
                }}
              >
                Delete local history
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
