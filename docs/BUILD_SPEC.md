# Align implementation specification

Status: Expo iOS prototype in active development. Updated 2026-09-19.

This is the build contract for the current branch. It moves the demo surface from the browser to a native Expo app; the existing web app remains useful for MediaPipe and metric development. **The OMNI-only speech rule is not superseded and still holds** — see section 5. Read this with [PRODUCT.md](../PRODUCT.md), [DESIGN.md](../DESIGN.md), and the [research dossier](research-chinese-scanners-and-omni.md).

## 1. Product outcome

Align turns one iPhone on a stand into a calm, hands-free posture capture guide. The user levels the phone, stands on a floor marker, captures front/right/back/left, and asks questions aloud without leaving the camera. The result is a repeatable local session and an honest multimodal coaching loop.

The app must never invent an angle, diagnosis, confidence value, or “perfect posture” score. Four completed views are capture completeness, not posture quality. Numeric findings appear only when the native pose pipeline supplies measurements that satisfy the definitions and validation rules below.

Priority order:

1. Beautiful, reliable Expo iOS capture flow.
2. A real OMNI image+audio understanding turn.
3. OMNI-native audio playback with matching captions, captions alone when OMNI returns text only.
4. Local saved history and recoverable failure states.
5. Native pose integration using the existing metric engine.
6. Movement tests and longitudinal comparison after static capture is verified.

## 2. Architecture

```text
iPhone camera + device motion + microphone
  -> Expo app: setup, capture state, local history, captions/playback
       -> selected JPEG + short recorded question + measured facts
          -> apps/api
             -> sponsor OMNI: joint image/audio reasoning, response text,
                and native speech audio when the model returns it
             -> caption-only fallback when OMNI returns text only

Native pose pipeline (next gate)
  -> packages/metrics -> versioned measurements -> results/history/OMNI context
```

Provider credentials exist only in the ignored server `.env`. The mobile app receives a backend URL and optional backend access token, never upstream API keys. The server binds to `127.0.0.1` for local simulator development. Physical-device and deployed demos require HTTPS or an explicitly reachable LAN endpoint.

Repository layout:

```text
apps/mobile/        Expo SDK 57 / React Native / Expo Router
apps/api/           Hono API, OMNI adapter
apps/web/           Existing browser MediaPipe baseline
packages/contracts/ Shared Zod schemas
packages/metrics/   Pure geometry and aggregation
```

## 3. Native experience

### Home

One primary action, a concise explanation, coach readiness, and real local sessions. No fabricated demo result. The signature interaction is visible immediately: the phone levels its camera before assessing the user.

### Consent

Explain local capture separately from cloud coaching. Local-only capture remains available. A cloud turn sends one bounded frame, one short recording, stage, capture notes, and verified measurements if present.

### Setup

Request camera access with a Settings recovery path. Use `expo-sensors` device motion to show horizon roll and guide the phone within a provisional ±3° tolerance. If the sensor is unavailable, allow an explicit override and record that limitation. Guide hip-height placement, full-body framing, fixed phone, and floor mark.

### Scan

Run front -> right -> back -> left. Show an on-camera silhouette/framing guide, a four-step rail, one instruction, and a three-second countdown. Stage each still in disposable app cache, then promote it to durable app storage only when the user chooses Save. Stop and Retake discard staged files. Push-to-talk records for at most 15 seconds; release captures the current frame and begins the OMNI turn. Show captions for every successful answer and play available speech.

### Recap

Show the four real captures and completion count. State clearly when native numeric measurement is not yet connected. Save summaries and durable capture references to SQLite. The home screen lists saved-session summaries; detail and deletion remain a stated next gate. Retaking resets and discards the staged capture rather than mixing protocols.

## 4. Expo track value

Expo is product infrastructure, not merely packaging:

- `expo-camera`: native full-screen capture, camera permission lifecycle, bounded stills.
- `expo-sensors`: a live level tool and future stand-bump detection during capture.
- `expo-audio`: push-to-talk recording and silent-mode-safe response playback.
- `expo-haptics`: completion confirmation after the camera surface is dismissed.
- `expo-sqlite`: local-first history with no account requirement.
- Expo Router: native navigation, deep-linkable routes, and clean screen ownership.
- EAS path: reproducible signed iOS demo builds and update delivery after the simulator gate passes.

The winning story is that Expo enables a coherent physical workflow: sensor-guided setup, camera capture, audio conversation, local persistence, native accessibility, and distributable iOS build in one system.

## 5. OMNI contract

OMNI is the sole reasoning and multimodal understanding layer. Every contextual coach answer must be based on the actual current image, the user's actual recorded audio, capture stage, and supplied verified measurements. Browser or on-device transcription followed by text-only prompting is not an acceptable substitute for the sponsor demonstration.

**OMNI is the only speech vendor. Do not add ElevenLabs or any other TTS/STT provider.** If OMNI returns native audio, play it. If it returns text only, show captions. Never present another vendor's voice as OMNI, and never fill an OMNI audio gap with a second provider. The response declares `speechProvider` as `omni` or `none`, so a demo can always state which case it is showing.

Browser or on-device transcription followed by a text-only prompt is likewise not acceptable: the sponsor demonstration requires OMNI to receive the actual recorded audio.

Default server configuration:

- OMNI base URL: `https://yibuapi.com/v1`
- OMNI model: `qwen3.5-omni-plus`

Defaults remain adapter configuration, not proof that the provider accepted a live turn. Record the actual provider/model, latency, and response mode during demo validation.

Only one coach turn is active per local session. Starting a new turn aborts the prior turn; clients discard stale request IDs. Never log raw media, provider keys, or full provider responses. Provider failures return stable application errors.

## 6. API and media controls

`POST /v1/coach/turn` accepts multipart `meta`, `image`, and `audio`. Metadata uses shared Zod schemas. Initial limits are one image <= 1 MB, one audio file <= 5 MB and nominally <= 15 seconds, metadata <= 32 KB, 45-second upstream timeout, and 12 turns/minute for local development. Production requires HTTPS, a server-validated access token, and rate limiting keyed by real session/client identity.

The application response contains request ID, text, optional audio base64/MIME, model, degraded flag, and speech provider. Raw provider errors are never returned to the client.

## 7. Measurement ownership and accuracy

The local metric engine owns numerical findings. OMNI can explain measurements but cannot create, modify, accept, or reject them. Native pose work must reuse `packages/metrics` and `packages/contracts` instead of inventing a second scoring system.

Supported initial metric definitions remain:

| Metric | Definition | Restriction |
| --- | --- | --- |
| shoulder_line_tilt | Projected shoulder-segment inclination in front/back view | Camera roll affects it. |
| head_line_tilt | Projected ear-segment inclination | Require both ears reliably visible. |
| head_shoulder_offset | Side-view ear/shoulder horizontal displacement normalized by trunk length | Proxy, not a clinical craniovertebral angle. |
| trunk_lean | Shoulder-midpoint to hip-midpoint inclination from image vertical | Surface-landmark proxy. |
| knee_flexion | 180° minus hip-knee-ankle internal angle | Do not infer hyperextension without a validated signed convention. |
| frontal_knee_alignment | Signed projected hip-knee-ankle deviation | Not a valgus/varus diagnosis. |
| arm_elevation | Shoulder-to-hip vs shoulder-to-elbow angle | Movement proxy, not isolated joint ROM. |

Convert normalized landmarks to pixel coordinates before 2D angles. Aggregate stable frames with the median; record sample count, dispersion, view, definition version, model/protocol version, and limitations. Do not display millimetres from monocular capture.

Before degree-level demo claims, collect repeated consented scans and compare the same definitions to manual source-frame annotations. Record absolute error, signed bias, failures, and repeatability. The provisional display gate is median absolute error <= 5° per metric; metrics that miss it remain exploratory or hidden.

## 8. Data and privacy

Use generated scan IDs; no face recognition is required. Keep unsaved stills in disposable app cache, promote explicitly saved sessions locally, and remove abandoned staged captures. Do not retain raw coach recordings or temporary coach frames after the request completes. Future cloud retention language must match verified OMNI policies before public use.

Users can complete a scan with cloud coaching disabled. Deleting a session must remove its database record and associated local files when deletion UI is added. Do not promise provider-side deletion without confirmed support.

## 9. Accessibility and native quality

- Minimum 44-point controls and system back/navigation behavior.
- Semantic text with wrapping under larger accessibility sizes.
- VoiceOver labels/hints for controls and meaningful imagery.
- Captions visible whenever generated speech plays.
- No color-only state; symbols and text accompany status colors.
- Reduce Motion removes nonessential scale/pulse effects.
- Permission denial, backgrounding, interruptions, and offline failures preserve local progress.
- Respect iOS safe areas and route audio through the speaker after recording.

## 10. Testing and release gates

- Unit: device-level classification, capture order/progress, geometry, provider fallback and error sanitization.
- Type/build: every workspace passes TypeScript/build; Expo bundles for iOS.
- Integration: API health reflects provider configuration; bounded multipart requests parse against shared contracts.
- Device: camera permission, motion sensor, temporary-to-persistent image copy, recording, silent-mode playback, background/resume, denied permissions.
- End to end: four captures -> spoken question -> real OMNI text -> OMNI audio or captions -> save -> return home and see the saved-session summary.
- Security: `.env` ignored; no provider key in Git, JS bundle, logs, or Expo public configuration.
- Performance: record actual p50/p95 turn latency and native capture responsiveness on the demo iPhone.

No completion claim is valid without current test/build output and a physical-device pass for native hardware behavior.

## 11. Current implementation and next gates

Implemented now: native screens and design system, camera-level setup, four-view capture, race-safe push-to-talk, OMNI adapter, OMNI-audio/caption handling, disposable media staging and cleanup, local SQLite session summaries, persistent saved stills, contracts, and unit tests.

Next gates:

1. Launch and visually inspect the app in the target iOS simulator.
2. Run a real bounded OMNI smoke turn and record the actual payload compatibility, including whether the account returns native audio.
3. Test camera, device motion, microphone, and playback on a physical iPhone.
4. Select a native pose route, connect it to the existing metrics package, and keep unsupported findings hidden.
5. Add session detail/deletion, movement tests, and comparable longitudinal history.
6. Configure EAS project/build profiles only after bundle ID and team ownership are confirmed.

## 12. Demo narrative

Open Align -> accept the explicit local/cloud choice -> place and level the phone -> step to the floor mark -> capture four guided views -> hold Ask coach and speak -> OMNI considers the live frame and audio -> OMNI's answer plays as speech when available and always appears as a caption -> finish capture -> see the four real views and honest measurement status -> save locally -> return home and see the session.

For judging, disclose the exact live model/provider, what Expo modules enable, which observations are measured locally, and which capabilities are future work. Sponsor eligibility and track requirements must be confirmed with current organizer documentation before submission.
