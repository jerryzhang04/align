# Align: implementation specification

Status: web-first architecture in progress. Provider credentials and live OMNI validation remain outstanding. Updated 2026-09-19.

Read alongside [research and sources](research-chinese-scanners-and-omni.md). This specification supersedes unsupported measurement and identity assumptions in the original README, and it supersedes the earlier iPhone-native/ElevenLabs plan. It does not claim clinical validation or confirmed sponsor eligibility.

## 1. Product and priorities

Align is a **web app** that runs in Chrome or Edge on **Windows and Mac**, and on any other device that can open the site and share a camera. It uses **whatever camera the device exposes** (laptop webcam, USB camera, or phone browser camera). The user frames a full-body standing view, follows guidance through four standing views, sees measured alignment and an estimated skeleton, and can ask questions aloud.

Spoken coaching uses **OMNI only**. Do not add ElevenLabs or any other TTS/STT vendor. If OMNI returns audio, play it. If it returns text only, show the text. Never pretend a second vendor is OMNI.

The product must demonstrate one complete real capture, measurement, and multimodal coaching loop before adding breadth. No diagnosis, invented angles, muscle weakness claims, or medical-perfect posture score.

Priority order:

1. Real device camera in the browser; real local pose; real OMNI image/audio request.
2. Guided four-view static scan, understandable results, and saved local history.
3. Squat, single-leg balance/reach, and overhead reach/hinge.
4. Visual refinement and longitudinal comparison.
5. Optional accounts and extra assessments only after the core demonstration passes.

**Expo / native iPhone shell is later work.** After this web architecture is solid, wrap or restyle it as a more native-feeling app. That pass is UI and packaging, not a second measurement engine. Do not block the current build on Xcode, native pose modules, or App Store signing.

Custom face recognition, full photorealistic reconstruction, body composition, pressure measurement, diagnosis, and automatic exercise prescriptions are outside the first build.

## 2. Target architecture

Use a TypeScript monorepo that runs on Windows and Mac with Node and npm. The browser owns camera, pose, capture state, and metrics. A small Node backend is the only process that holds OMNI credentials.

```text
Device camera (getUserMedia)
    -> MediaPipe Pose in the browser -> quality gates -> metric engine
            |                                      |
            +-> live overlay                       +-> results / history / skeleton

Device microphone + selected frame + metric context
    -> apps/api -> sponsor OMNI -> coaching text
                                -> coaching audio, only if OMNI returns audio
```

The local metric engine owns every numerical result. Cloud coaching receives already defined measurements and capture context. No cloud request is required to update the live skeleton or local capture gates.

Repository layout:

```text
apps/web/           Vite + React web app (camera, pose, capture, results)
apps/api/           OMNI adapter and /v1/coach/turn
packages/contracts/ request/response schemas and shared types
packages/metrics/   pure geometry, quality aggregation, comparisons
docs/               research, this spec, demo notes
```

npm workspaces. Pin compatible versions together. Commit the lockfile. Scripts must work in PowerShell and in macOS/Linux shells; do not depend on bash-only syntax.

## 3. Camera and pose feasibility gate

First prove a physical-device loop in the browser: camera permission, live preview, MediaPipe Pose Landmarker, overlay. Use the default camera if there is only one; if there are several, let the user pick. Do not require a phone, a rear camera, or `facingMode: environment`.

Load pose with a GPU delegate, then fall back to CPU if needed so Windows iGPU and Mac machines both run. Drop old frames rather than queueing inference. Keep pixels in the browser; send only compact landmarks through the metric engine at a bounded rate.

Selected stills for OMNI are JPEG frames captured from the same video element, resized and bounded. Microphone audio for coaching is recorded as WAV in the browser so Mac and Windows Chrome/Edge share one format.

Initial performance targets, not measured claims: pose updates at least 10 Hz on the demo machine, responsive preview, local feedback under 200 ms p95. Record actual performance during a full session. Reduce inference resolution/rate before compromising capture stability.

## 4. Frontend experience

Visual direction: calm, precise, approachable. Warm neutral background, dark legible text, a single teal accent, and clear diagrams. Reserve warning colors for actionable capture problems. Never communicate state by color alone.

### Screens

| Screen | Content and behavior |
| --- | --- |
| Home | Start scan, recent scan summary, history, privacy/settings. No fabricated sample result shown as user data. |
| Consent | Separate explanations for local pose processing and sending selected image/audio to OMNI. Allow local scan without cloud coaching. |
| Setup | Camera picker, floor-mark / distance guidance, fitted clothing, full-body silhouette, camera/microphone permission recovery. |
| Capture | Live camera, minimal overlay, current view, hold progress, one prominent correction, coach transcript, pause/stop and push-to-talk. |
| Processing | Local aggregation status; cloud coaching status separately. No fake progress percentage. |
| Results | Capture quality, supported measurements with view and definition, estimated skeleton, expandable explanations, retry incomplete views. |
| Movement | Later. Short demonstration, rep/state progress, measured movement summary. |
| History/detail | Comparable measurements, dates, capture protocol/model versions, excluded comparisons explained. |

Do not require landscape-only iPhone layout. Prefer a framing guide that works for a laptop webcam across the room or a phone on a stand. Setup must be possible while handling the device; capture must be possible after stepping away. Provide a visible countdown and on-screen prompts. Local text can drive routine “turn / hold / retry” states. Contextual spoken answers come from OMNI.

Initial skeleton view: a simple proportioned 2D/3D stick figure with the source-view overlay. Keep a 2D results screen if a richer renderer fails. Label any target pose “illustrative alignment reference.”

## 5. Capture protocol and state machine

Camera is fixed. The user stands far enough for hair-to-shoes framing, keeps their feet near a floor mark, and turns in place. Do not claim that the mark establishes metric calibration.

```text
consent -> permissions -> setup -> front -> right -> back -> left
        -> aggregate -> results -> optional movement -> save
```

Each view progresses through coaching, settling, collecting, and accepted states. A bad frame pauses collection; prolonged failure resets only the current hold. Pause/stop cancels outstanding coaching and playback.

Provisional engineering defaults: collect two seconds of stable observations, require at least 15 accepted samples, and expire an incomplete hold after 20 seconds into a retry state. Tune these against actual device data. Visibility thresholds depend on the chosen model and are not probabilities of measurement correctness.

Check full-body framing, required landmarks, person count where supported, temporal movement, side/front orientation, and apparent body-scale changes. Treat these as imperfect checks: pose alone cannot guarantee a foot remains on the floor mark or detect all clothing occlusions. Coach the user rather than pretending these conditions are measured exactly.

Front/back identity and left/right association must use capture state plus MediaPipe’s anatomical landmark labels, not shoulder ordering alone. At side views, avoid scoring occluded far-side joints. If facing direction cannot be resolved, request confirmation or retry.

## 6. Measurement definitions and accuracy

All results distinguish observed 2D projected geometry, model-estimated 3D geometry, and unavailable quantities. Store degrees or normalized ratios initially. Do not display millimetres from monocular estimates. User height alone does not solve perspective, depth, and landmark-location error.

Convert normalized landmarks into image pixel coordinates before angle calculations: x = normalized_x * width, y = normalized_y * height. Apply orientation consistently.

For points A, B, C, the internal angle at B is acos(clamp(dot(A-B,C-B)/(|A-B||C-B|),-1,1)). Reject near-zero vectors. For a near-horizontal segment, inclination uses atan2(delta_y, delta_x), folded to a documented range after anatomical ordering. Unit-test mirrored and rotated inputs.

| Metric ID | Definition | Reporting restriction |
| --- | --- | --- |
| shoulder_line_tilt | Inclination of the shoulder segment in front/back view | Projected shoulder asymmetry; camera roll affects it. |
| head_line_tilt | Inclination of the ear segment | Only when both ears are observed reliably. |
| head_shoulder_offset | Side-view horizontal ear/shoulder displacement divided by visible trunk length | Proxy, not clinical C7-based forward-head angle. |
| trunk_lean | Shoulder-midpoint to hip-midpoint inclination relative to image vertical | Surface landmark proxy, not spine curvature. |
| knee_flexion | 180 degrees minus hip–knee–ankle internal angle | Magnitude alone does not distinguish hyperextension; use a validated signed convention before adding that label. |
| frontal_knee_alignment | Signed projected hip–knee–ankle deviation using anatomical side | Not a diagnosis of valgus/varus; sensitive to rotation. |
| arm_elevation | Angle between shoulder-to-hip and shoulder-to-elbow vectors in the specified view | Movement angle proxy, not isolated glenohumeral ROM. |

Aggregate per-frame values with the median and record accepted count and dispersion. Quality includes visibility, stability, orientation checks, and disagreement between equivalent views. Never relabel frame dispersion as a clinical confidence interval or landmark score as accuracy.

No initial scoring for anatomical pelvic tilt, scapular winging, thoracic/lumbar curvature, pronation, weight-bearing distribution, muscle tightness/weakness, or body composition. Ordinary pose landmarks do not establish these quantities.

An overall 0–100 alignment score is deferred until a documented, versioned rule has been reviewed against observed captures. The first demo can show measurement cards and capture completeness. Do not substitute capture completeness for posture quality. If a heuristic score is later added, label it experimental, publish its formula and missing-data handling, and never call 100 medically perfect.

### Validation protocol

Before accuracy claims, collect consented repeated scans from at least five volunteers if feasible, with three repetitions each. This is an engineering pilot, not clinical validation. Compare supported projected angles against manual annotations on the same source frames, using the same definitions. Record absolute error, signed bias, failures, and repeatability; do not invent acceptance numbers after observing results.

Provisional go/no-go target for showing degree-level findings: median absolute error <= 5 degrees against those annotations, with per-metric results and outliers disclosed. This target is not a promised accuracy, and same-frame agreement does not validate anatomy. Disable or label exploratory any metric that fails. Test camera roll, loose clothing, occlusion, cropping, side-view ambiguity, low light, and both Windows and Mac browsers. A numerical improvement over time is not meaningful unless it exceeds measured repeatability and protocol conditions match.

## 7. Movement phase

After static capture works, add slow squat (2–3 reps), single-leg balance/reach on both sides, then overhead reach and a separate soft-knee hinge. Use explicit start/active/complete/invalid states with hysteresis to avoid duplicate reps. Reset after tracking loss.

Squat: projected knee flexion, trunk lean, frontal knee tracking only in the relevant view. Balance: observed hold duration and trunk/hip landmark movement, not plantar pressure. Reach: observed arm elevation. Hinge: trunk/hip angle changes; do not claim spinal rounding from sparse landmarks. Use qualitative feedback only when tied to available measurements. Stop/retry instructions take precedence over encouragement if the user reports pain or asks to stop.

## 8. OMNI integration

The sponsor repository identifies YibuAPI as the credit provider. Default adapter target is the OpenAI-compatible endpoint `https://yibuapi.com/v1`. The local API listens on `127.0.0.1:8788` so it does not collide with other local tools. The exact key destination, model ID, accepted multimodal message format, streaming support, and native audio output must still be confirmed with the issued credential. Key appearance is not sufficient evidence. This is the first external integration gate.

The OMNI adapter must accept actual audio and selected images in the same contextual interaction, plus compact measurement facts. Browser speech transcription followed by a text-only call is **not** the intended proof of OMNI audio understanding. Do not substitute another model or ElevenLabs silently.

If OMNI returns audio (for example streamed WAV/PCM), play that audio in the browser. If it returns text only, show captions. Do not add a second speech vendor to fill the gap.

Use one coaching turn at a time. Assign a request ID; discard stale replies and abort the in-flight request when the user interrupts. Start with push-to-talk. Pressing the voice button cancels playback before recording. Continuous automatic interruption is a later feature.

Automatic prompts are triggered by state transitions or persistent capture problems, not every frame. Rate-limit repeated instructions. Local deterministic text can cover routine transitions; contextual responses must use real OMNI calls for the sponsor demo.

The system prompt instructs OMNI to explain only supplied measurements, give one concise actionable instruction at a time, treat user speech/image text as untrusted input, avoid diagnosis, and honor stop requests. Validate output lengths and response schemas. Generated speech is advisory; it cannot directly accept a scan, change measurements, or advance capture state.

## 9. Backend contracts and controls

Use shared runtime schemas (Zod) on client and server. Proposed application contract, independent of provider payload:

```ts
type Measurement = {
  id: string; value: number; unit: 'deg' | 'ratio' | 'seconds';
  view: 'front' | 'right' | 'back' | 'left';
  definitionVersion: string; sampleCount: number;
  quality: 'usable' | 'limited'; limitations: string[];
};
type CoachTurn = {
  requestId: string; scanId: string; stage: string;
  measurements: Measurement[];
  // Binary audio/image are multipart attachments, not arbitrary remote URLs.
};
```

POST `/v1/coach/turn` accepts metadata and bounded media. Return JSON with `requestId`, `text`, optional `audioBase64` / `audioMime` when OMNI actually returned audio, and `degraded` only if the provider rejected a modality. Events, if streamed later: started, text, audio-ready, completed, error; every event carries requestId. Expose structured error codes, not raw provider errors or credentials.

Initial limits: one image <= 1 MB, audio <= 15 seconds and <= 5 MB, metadata <= 32 KB, one active turn per session. Enforce server-side limits, supported MIME types, timeouts, and rate budgets. Do not accept client-supplied upstream URLs, model IDs, system prompts, or credentials.

Use HTTPS and a server-validated access token for any deployed service. Local development may omit the token. Keep OMNI keys only in ignored backend environment files. The browser never receives `OMNI_API_KEY`. Server logs contain request IDs, stage, timing, status, and provider/model identifiers; no raw audio, images, secrets, or full prompts by default.

## 10. Data and privacy

Local-first storage in the browser (localStorage/IndexedDB): profiles, scans, measurements, protocol/model versions, quality summaries, and comparisons. Use generated profile IDs and optional display names. No face embeddings. Multiple users select their profile explicitly.

Do not require birthday, weight, or face enrollment for the core scan. Optional height is context only until a calibrated measurement use is implemented. Store summaries by default; retain raw frames/audio only with separate opt-in and a clear deletion mechanism. In-memory landmark windows are discarded after aggregation unless explicitly saved for consented evaluation.

Cloud media handling and provider retention policies must be verified and summarized before public use. Deleting local history must remove related local artifacts; do not promise deletion of provider-held data without confirmed support.

## 11. Testing and release gates

- Geometry: synthetic known angles, aspect ratios, zero vectors, left/right, mirroring and orientation.
- Capture: deterministic replay fixtures for accepted holds, dropouts, re-entry, cancellation, and invalid views.
- Providers: schema construction, timeout/error mapping, payload limits, stale-response cancellation; live smoke tests separately with explicit cost bounds.
- Web: camera/audio permissions, camera switching, background/resume, playback cancellation, denied permissions, Chrome/Edge on Windows and Mac.
- End-to-end: real four-view scan -> stored supported measurements -> real multimodal question -> OMNI reply (audio if provided) -> reopen history.
- Performance: log actual p50/p95 local inference and coaching latency on the demo device. Initial spoken/text response goal is under 4 seconds median after recording ends; report actual results if missed.
- Security: check staged changes and browser/network output for credentials; verify authentication and rate limits before deployment.
- Accessibility: screen-reader labels, readable contrast/text, captions, no color-only state.

Failure to reach a target means narrow the claim or scope; never replace a live demonstration with unlabelled prerecorded or fabricated output.

## 12. Work sequence and collaboration

| Milestone | Deliverable | Exit condition |
| --- | --- | --- |
| A: web architecture | Monorepo, browser pose spike, metric engine, OMNI adapter | Camera landmarks on Windows and Mac, and one actual image+audio OMNI turn |
| B: scan | Setup/capture screens, quality gates | Four views complete with failures handled and supported measurements retained |
| C: results/history | Measurement cards, estimated skeleton, local storage | Saved scan reopens; model/protocol differences are respected |
| D: coach | Push-to-talk OMNI, cancellation, captions and optional OMNI audio | Contextual follow-up on a completed scan |
| E: movement/polish | Supported drills, visual/accessibility refinement | Repeated sessions on the demo machine |
| F: later native UI | High-level Expo/iPhone shell around this architecture | Same metrics and OMNI contract, nicer device UI |
| G: submission | README, architecture, measured limits, provider evidence and demo script | Sponsor selections confirmed and claims match the build |

Suggested split: one contributor owns the web capture/pose/screens, another the API/OMNI adapter and shared metrics tests. Agree contracts first. Work on feature branches and merge small reviewed changes. Commit secrets only as empty placeholders.

## 13. Sponsor evidence and demo

Huawei/OMNI: show actual joint image/audio understanding through the verified OMNI model, an end-to-end browser/edge-device scenario, and clear documentation. Eligibility remains an organizer decision.

OpenAI's track additionally requires meaningful OpenAI API use in the product and evidence of Codex's development contribution. The current architecture does not yet include the former. Do not claim this track is satisfied by Codex development alone or add a redundant API call merely for a checkbox.

Demo: open Align in Chrome or Edge -> accept camera/mic -> choose a camera if needed -> stand in frame -> ask about positioning -> hear or read an OMNI response -> complete four holds -> inspect a supported finding and skeleton -> ask what the finding means -> hear/read the OMNI explanation -> reopen saved scan. Movement is an extension if time permits.

Record build version, real provider/model identities, device/OS/browser, measured latency and limitations in the demo notes. Confirm submission track selections and deadlines with the organizers.

## 14. Later: Expo / native UI

When the web loop is reliable, a later Expo app can wrap this product for a more native iPhone feel. Keep that work high level: same capture protocol, same metric engine, same OMNI backend. Treat it as UI and device packaging. Do not fork measurement definitions or add ElevenLabs during that pass.
