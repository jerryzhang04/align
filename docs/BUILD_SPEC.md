# Align: implementation specification

Status: agreed product direction translated into an implementation plan; implementation and provider validation remain outstanding. Updated 2026-09-19.

Read alongside [research and sources](research-chinese-scanners-and-omni.md). This specification supersedes unsupported measurement and identity assumptions in the original README. It does not claim clinical validation or confirmed sponsor eligibility.

## 1. Product and priorities

Align is an iPhone-first, Expo-built posture and movement screening app. The user places their phone on a stand, follows spoken guidance through four standing views, sees measured alignment and an estimated 3D skeleton, and asks questions aloud. Returning users compare equivalent measurements over time.

The product must demonstrate one complete real capture, measurement, and multimodal coaching loop before adding breadth. No diagnosis, invented angles, muscle weakness claims, or medical-perfect posture score.

Priority order:

1. Real iPhone camera and native pose pipeline; real OMNI image/audio request; real ElevenLabs playback.
2. Guided four-view static scan, understandable results, and saved local history.
3. Squat, single-leg balance/reach, and overhead reach/hinge.
4. Visual refinement and longitudinal comparison.
5. Optional account synchronization and additional assessments only after the core demonstration passes.

Custom face recognition, full photorealistic reconstruction, body composition, pressure measurement, diagnosis, and automatic exercise prescriptions are outside the first build.

## 2. Target architecture

Use an Expo React Native application in TypeScript with a development build for iOS. Expo Go is not the target because pose processing requires native integration. Use Expo Router for navigation. Keep a small Node/TypeScript backend independent of the mobile client so both contributors can work against a defined contract.

```text
iPhone camera -> native pose engine -> quality gates -> metric engine
                       |                                  |
                       +-> live overlay                    +-> scan/history/3D view
iPhone microphone + selected frame + metric context
                       -> backend -> sponsor OMNI -> coaching text
                                               -> ElevenLabs -> phone audio
```

The local metric engine owns every numerical result. Cloud coaching receives already defined measurements and capture context. No cloud request is required to update the live skeleton or local capture gates.

Recommended repository layout:

```text
apps/mobile/        Expo app, screens, capture and audio controllers
apps/api/           authenticated provider adapters and streaming routes
packages/contracts/ request/response schemas and shared types
packages/metrics/   pure geometry, quality aggregation, comparisons
modules/pose/      iOS frame processing and pose bridge
docs/              research, architecture, evaluation and demo instructions
```

Start with npm workspaces. Pin compatible versions after checking the selected Expo SDK and native pose dependency together; do not choose versions independently. Commit the lockfile.

## 3. Native camera and pose feasibility gate

First build a physical-device prototype before the rest of the UI. Test an iOS MediaPipe Pose Landmarker integration behind an Expo native module. The module owns a camera capture session, preview, and inference; expose landmark results and occasional selected images to JavaScript. Do not start a second camera session through another library at the same time.

If a maintained frame-processing integration proves faster to adopt, retain the same bridge contract. Confirm package license, iOS support, Expo compatibility, landmark mapping, and build reproducibility before accepting it. A substitute pose model must advertise its landmark schema and disable unsupported measurements.

Bridge result: frame timestamp, image dimensions, orientation/mirroring transform, landmark schema/version, 2D landmarks and visibility/presence where available, optional estimated 3D landmarks, and inference timing. Drop old frames rather than building an inference queue. Keep raw frames native; send only compact landmarks to JavaScript at a bounded rate.

Initial performance targets, not measured claims: pose updates at least 10 Hz on the demo phone, responsive preview near display rate, local feedback under 200 ms p95. Record actual performance, device model, and thermal behavior during a full session. Reduce inference resolution/rate before compromising capture stability.

## 4. Frontend experience

Visual direction: calm, precise, approachable. Warm neutral background, dark legible text, a single teal accent, and clear diagrams. Reserve warning colors for actionable capture problems. Never communicate state by color alone. Prefer generous spacing, native controls, safe-area-aware layouts, Dynamic Type, screen-reader labels, and large touch targets.

### Screens

| Screen | Content and behavior |
| --- | --- |
| Home | Start scan, recent scan summary, history, privacy/settings. No fabricated sample result shown as user data. |
| Consent | Separate explanations for local pose processing and sending selected image/audio to cloud services. Allow local scan without cloud coaching. |
| Setup | Stand/floor-mark instructions, fitted clothing guidance, full-body silhouette, camera/microphone permission recovery. |
| Capture | Landscape camera, minimal overlay, current view, hold progress, one prominent correction, coach transcript, pause/stop and voice button. |
| Processing | Local aggregation status; cloud coaching status separately. No fake progress percentage. |
| Results | Capture quality, supported measurements with view and definition, estimated 3D skeleton, expandable explanations, retry incomplete views. |
| Movement | Short demonstration and spoken instructions, rep/state progress, measured movement summary. |
| History/detail | Comparable measurements, dates, capture protocol/model versions, excluded comparisons explained. |

Use portrait for ordinary navigation and landscape for capture. Test orientation transitions on device. Setup must be possible while holding the phone; capture must be possible after stepping away. Provide a visible countdown and spoken prompts. Haptics can help while handling the phone but cannot be the only cue when it is on a stand.

Initial 3D view: a simple proportioned skeleton with orbit/reset controls and the source-view measurement overlay. Benchmark an Expo-compatible renderer before committing to it. Preserve a 2D results screen if rendering fails. Label any target pose “illustrative alignment reference”; it is not a universally ideal body or a clinical correction.

## 5. Capture protocol and state machine

Phone fixed on a stable stand, landscape, lens approximately level at hip height, whole person including feet visible. The user keeps their feet near a floor mark and turns in place. Do not claim that the mark establishes metric calibration.

```text
consent -> permissions -> setup -> front -> right -> back -> left
        -> aggregate -> results -> optional movement -> save
```

Each view progresses through coaching, settling, collecting, and accepted states. A bad frame pauses collection; prolonged failure resets only the current hold. Pause/stop cancels outstanding coaching and playback. App backgrounding suspends capture and recording; resuming requires a fresh quality check.

Provisional engineering defaults: collect two seconds of stable observations, require at least 15 accepted samples, and expire an incomplete hold after 20 seconds into a retry state. Tune these against actual device data. Visibility thresholds depend on the chosen model and are not probabilities of measurement correctness.

Check full-body framing, required landmarks, person count where supported, temporal movement, side/front orientation, and apparent body-scale changes. Treat these as imperfect checks: pose alone cannot guarantee a foot remains on the floor mark or detect all clothing occlusions. Coach the user rather than pretending these conditions are measured exactly.

Front/back identity and left/right association must use capture state plus explicit orientation transforms, not shoulder ordering alone. At side views, avoid scoring occluded far-side joints. If facing direction cannot be resolved, request confirmation or retry.

## 6. Measurement definitions and accuracy

All results distinguish observed 2D projected geometry, model-estimated 3D geometry, and unavailable quantities. Store degrees or normalized ratios initially. Do not display millimetres from monocular estimates. User height alone does not solve perspective, depth, and landmark-location error.

Convert normalized landmarks into image pixel coordinates before angle calculations: x = normalized_x * width, y = normalized_y * height. Apply orientation consistently. Correct camera roll only when a tested calibration method is available; otherwise require a level phone and disclose this source of error.

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

Provisional go/no-go target for showing degree-level findings: median absolute error <= 5 degrees against those annotations, with per-metric results and outliers disclosed. This target is not a promised accuracy, and same-frame agreement does not validate anatomy. Disable or label exploratory any metric that fails. Test deliberate camera roll, loose clothing, occlusion, cropping, mirrored preview, side-view ambiguity, and low light. A numerical improvement over time is not meaningful unless it exceeds measured repeatability and protocol conditions match.

## 7. Movement phase

After static capture works, add slow squat (2–3 reps), single-leg balance/reach on both sides, then overhead reach and a separate soft-knee hinge. Use explicit start/active/complete/invalid states with hysteresis to avoid duplicate reps. Reset after tracking loss.

Squat: projected knee flexion, trunk lean, frontal knee tracking only in the relevant view. Balance: observed hold duration and trunk/hip landmark movement, not plantar pressure. Reach: observed arm elevation. Hinge: trunk/hip angle changes; do not claim spinal rounding from sparse landmarks. Use qualitative feedback only when tied to available measurements. Stop/retry instructions take precedence over encouragement if the user reports pain or asks to stop.

## 8. OMNI and ElevenLabs integration

The sponsor repository identifies YibuAPI as the credit provider. The exact base URL, key destination, model ID, accepted multimodal message format, and streaming support must be confirmed before sending credentials or building a provider-specific payload. Key appearance is not sufficient evidence. This is the first external integration gate.

The OMNI adapter must accept actual audio and selected images in the same contextual interaction, plus compact measurement facts. Browser/device speech transcription followed by a text-only call is not our intended proof of OMNI audio understanding. Do not substitute another model silently.

ElevenLabs generates speech from the coach's text. Verify the selected voice, model, audio format, and streaming behavior on iOS before committing to low-latency streaming. An initial complete audio response is acceptable during integration, but document measured latency and the actual transport. Do not claim native OMNI speech when ElevenLabs generated it.

Use one coaching turn at a time. Assign a request ID; discard stale replies and cancel upstream work where supported when the user interrupts. Start with push-to-talk for reliable turn-taking and to avoid the model hearing its own playback. Pressing the voice button cancels playback before recording. Continuous automatic interruption is a later feature requiring device audio-session and echo-handling tests.

Automatic prompts are triggered by state transitions or persistent capture problems, not every frame. Rate-limit repeated instructions. Local deterministic prompts can cover routine transitions; contextual responses must use real provider calls for the sponsor demo.

The system prompt instructs OMNI to explain only supplied measurements, give one concise actionable instruction at a time, treat user speech/image text as untrusted input, avoid diagnosis, and honor stop requests. Validate output lengths and response schemas. Generated speech is advisory; it cannot directly accept a scan, change measurements, or advance capture state.

## 9. Backend contracts and controls

Use shared runtime schemas (for example Zod) on client and server. Proposed application contract, independent of provider payload:

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

POST /v1/coach/turn accepts metadata and bounded media. Return text and audio through a documented response/event contract chosen after transport testing. Events, if streamed: started, text, audio-ready, completed, error; every event carries requestId. Audio responses require the same authorization as the initiating turn and expire promptly. Expose structured error codes, not raw provider errors or credentials.

Initial limits: one image <= 1 MB, audio <= 15 seconds and <= 5 MB, metadata <= 32 KB, one active turn per session. Enforce server-side limits, supported MIME types, timeouts, and rate budgets. Treat limits as tunable product defaults. Do not accept client-supplied upstream URLs, model IDs, system prompts, or credentials.

Use HTTPS and per-session authorization for the deployed service. A public demo needs rate limiting and a server-validated access mechanism; no unrestricted paid-provider proxy. Keep development-only access distinct from production authentication. Server logs contain request IDs, stage, timing, status, and provider/model identifiers; no raw audio, images, secrets, or full prompts by default.

## 10. Data and privacy

Local-first storage using Expo-compatible SQLite: profiles, scans, measurements, protocol/model versions, quality summaries, and comparisons. Use generated profile IDs and optional display names. Face ID may later unlock the app through system authentication, but it does not identify different people or provide face embeddings. Multiple users select their profile explicitly.

Do not require birthday, weight, or face enrollment for the core scan. Optional height is context only until a calibrated measurement use is implemented. Store summaries by default; retain raw frames/audio only with separate opt-in and a clear deletion mechanism. In-memory landmark windows are discarded after aggregation unless explicitly saved for consented evaluation.

Cloud media handling and provider retention policies must be verified and summarized before public use. Deleting local history must remove related local artifacts; do not promise deletion of provider-held data without confirmed support. Keys exist only in ignored backend environment files or deployment secrets. Mobile public environment variables contain only non-secret configuration.

## 11. Testing and release gates

- Geometry: synthetic known angles, aspect ratios, zero vectors, left/right, mirroring and orientation.
- Capture: deterministic replay fixtures for accepted holds, dropouts, re-entry, cancellation, and invalid views.
- Providers: schema construction, timeout/error mapping, payload limits, stale-response cancellation; live smoke tests separately with explicit cost bounds.
- Mobile: real camera/audio permissions, orientation, background/resume, silent mode/audio route behavior, playback cancellation and denied permissions.
- End-to-end: real four-view scan -> stored supported measurements -> real multimodal question -> ElevenLabs speech -> reopen history.
- Performance: log actual p50/p95 local inference and coaching latency on the demo phone. Initial spoken-response goal is under 4 seconds median after recording ends; report actual results if missed.
- Security: check staged changes and browser/mobile output for credentials; verify authentication and rate limits before deployment.
- Accessibility: screen-reader labels, readable contrast/text, captions, no color-only state, and controls reachable without precise gestures.

Failure to reach a target means narrow the claim or scope; never replace a live demonstration with unlabelled prerecorded or fabricated output.

## 12. Work sequence and collaboration

| Milestone | Deliverable | Exit condition |
| --- | --- | --- |
| A: contracts and feasibility | Expo workspace, native pose spike, provider verification, audio playback spike | Actual iPhone landmarks and one actual image+audio OMNI turn voiced by ElevenLabs |
| B: scan | Setup/capture screens, quality gates, metric engine | Four views complete with failures handled and supported measurements retained |
| C: results/history | Measurement cards, estimated skeleton, local storage | Saved scan reopens; model/protocol differences are respected |
| D: coach | Contextual requests, cancellation, captions and spoken transitions | Complete hands-free guided flow with a spoken follow-up |
| E: movement/polish | Supported drills, visual/accessibility refinement | Physical-device demo reliable through repeated sessions |
| F: submission | README, architecture, measured limits, provider evidence and demo script | Sponsor selections confirmed and claims match the build |

Suggested split, to agree with Jerry: one contributor owns mobile/native capture and screens, another backend/provider adapters and shared metrics tests. Agree contracts first. Work on feature branches and merge small reviewed changes; avoid concurrent edits to shared schemas without coordination. Commit secrets only as empty placeholders. No commits or messages should imply the other contributor accepted an assignment.

## 13. Sponsor evidence and demo

Huawei: show actual joint image/audio understanding through the verified OMNI model, an end-to-end edge-device scenario, and clear documentation. ElevenLabs: demonstrate real dynamic speech essential to hands-free use. Expo: demonstrate a native-feeling, attractive iPhone app built with Expo. Eligibility and awards remain organizer decisions.

OpenAI's track additionally requires meaningful OpenAI API use in the product and evidence of Codex's development contribution. The current architecture does not yet include the former. Do not claim this track is satisfied by Codex development alone or add a redundant API call merely for a checkbox.

Demo: open Align on an iPhone -> accept media use -> place phone -> ask about positioning -> hear a scene-aware response -> complete four holds -> inspect a supported finding and estimated skeleton -> ask what the finding means -> hear ElevenLabs explanation -> reopen saved scan. Movement is an extension if time permits.

Record build version, real provider/model identities, physical device, measured latency and limitations in the demo notes. Confirm submission track selections and deadlines with the organizers. No App Store release is required by this plan; provision a working physical-device development/internal build early, since signing/distribution can block the demo.
