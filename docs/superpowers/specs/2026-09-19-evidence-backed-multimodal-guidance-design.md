# Evidence-Backed Multimodal Guidance Design

**Status:** Proposed for implementation  
**Date:** 2026-09-19  
**Product boundary:** Wellness guidance, not diagnosis or treatment  
**Primary demo surface:** Expo iPhone app  
**Current development provider:** Gemini 2.5 Flash through OpenRouter  
**Sponsor provider:** Qwen3.5-Omni Plus through YibuAPI when credentials are approved

## 1. Outcome

Align will deliver one complete, repeatable user scenario:

1. The user consents to local capture and optional cloud guidance.
2. The user levels the phone and captures front, right, back, and left views.
3. The user records one short spoken goal or question about the completed scan.
4. The server sends the four ordered images, the actual recording, capture context, and the approved evidence context to the configured multimodal model.
5. The server validates the model response against a strict guidance contract and deterministic safety policy.
6. The app presents visible observations, conservative actions, limitations, evidence citations, and either provider-native speech or captions.
7. The complete guidance report and captures can be saved locally.

This flow is intentionally narrow. It demonstrates why vision, speech, and language are useful together without waiting for native numerical pose measurement or presenting the system as a medical device.

## 2. Competition alignment

The implementation must make the following facts demonstrable:

- A phone is the real edge-device endpoint.
- The model receives the user's actual audio rather than a local transcript.
- The model receives all four real scan images in their capture order.
- Vision, speech, and language contribute to one answer rather than appearing as disconnected features.
- The experience reaches a useful recap without relying on a hidden or optional in-scan control.
- The configured provider and model are shown truthfully. The development fallback must never be presented as OMNI.
- The sponsor provider can replace the fallback through environment configuration without changing the client contract.
- Failures preserve local captures and explain whether the provider, network, response validation, or configuration failed.

## 3. Non-goals

This implementation will not:

- redesign the application UI or visual system;
- diagnose a condition or infer a cause of pain;
- label scoliosis, pelvic tilt, leg-length discrepancy, muscle weakness, spinal curvature, or another clinical condition from images;
- create angles, distances, confidence percentages, or posture scores;
- prescribe medication, treatment, rehabilitation, or condition-specific exercise;
- claim that a particular static posture caused or will cause pain;
- implement the native pose pipeline;
- depend on live web search for health guidance;
- add another speech, transcription, or text-to-speech provider.

## 4. User flow

### 4.1 Capture

The existing consent, setup, and four-view capture sequence remains. Each capture retains its `ViewId` so the backend receives an explicit order rather than inferring orientation.

After the fourth capture, the scan screen enters a minimal final-question state instead of navigating directly to recap. It asks the user to hold the existing recording control and describe what they want help with, for example comfort while working, general movement habits, or understanding a visible pattern. A secondary action allows the user to finish without cloud guidance.

### 4.2 Guidance request

Releasing the recording control sends:

- request and scan identifiers;
- the four view identifiers in protocol order;
- four bounded JPEG images;
- one bounded audio recording;
- capture/setup notes;
- verified local measurements only when the native measurement pipeline eventually supplies them;
- requested locale.

The current implementation sends an empty measurement array. The model is forbidden from filling that absence with invented numbers.

### 4.3 Recap

On success, the app stores the structured report in scan state and navigates to recap. Recap renders the existing capture grid plus plain text for the report summary, observations, actions, limitations, safety message, and source titles. Source URLs remain part of the saved report even if the initial UI does not yet make every citation interactive.

If the provider returns native speech, it plays with matching captions. If the provider returns text only, captions are the complete successful experience and the response declares that speech was unavailable.

If analysis fails, the user can retry or continue to recap and save the captures. A failed cloud request never discards the scan.

## 5. API contract

### 5.1 Health

`GET /v1/health` returns:

```ts
type ProviderMode = "omni" | "development-fallback" | "unconfigured";

type HealthResponse = {
  ok: true;
  guidanceConfigured: boolean;
  providerMode: ProviderMode;
  provider: "yibu" | "openrouter" | "custom" | null;
  model: string | null;
  nativeAudioExpected: boolean;
};
```

`guidanceConfigured` means the configured endpoint has a key. It does not imply that sponsor OMNI is configured. The mobile app must not display “OMNI configured” unless `providerMode === "omni"`.

### 5.2 Four-view guidance

`POST /v1/guidance/report` accepts multipart fields:

- `meta`: JSON matching `scanGuidanceMetaSchema`;
- `front`, `right`, `back`, `left`: one image file each;
- `audio`: one audio file.

The initial bounds are 1 MB per image, 5 MB audio, 15 seconds nominal audio duration, and 32 KB metadata. The server validates names, MIME types, counts, and sizes before reading files into memory.

The successful response matches:

```ts
type EvidenceLevel = "guideline" | "systematic-review" | "occupational-guidance";
type SafetyLevel = "wellness" | "seek-professional-care" | "urgent-care";

type GuidanceObservation = {
  id: string;
  text: string;
  basedOnViews: ViewId[];
  limitations: string[];
};

type GuidanceAction = {
  id: string;
  title: string;
  instruction: string;
  rationale: string;
  sourceIds: string[];
};

type EvidenceCitation = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  level: EvidenceLevel;
  reviewedAt: string;
};

type GuidanceReport = {
  requestId: string;
  summary: string;
  observations: GuidanceObservation[];
  actions: GuidanceAction[];
  limitations: string[];
  safety: {
    level: SafetyLevel;
    message: string;
    signalIds: string[];
  };
  sources: EvidenceCitation[];
  audioBase64?: string;
  audioMime?: string;
  speechProvider: "omni" | "none";
  providerMode: ProviderMode;
  model: string;
  latencyMs: number;
  degraded?: boolean;
};
```

Provider and validation failures use stable application error codes. Raw provider bodies, prompts, media, and credentials are not returned or logged.

The existing `POST /v1/coach/turn` remains temporarily available for the browser baseline and in-scan single-frame questions. The complete iPhone flow uses `/v1/guidance/report`.

## 6. Evidence catalog

The server owns a checked-in, versioned catalog. The model cannot invent or directly generate citation metadata. Each catalog entry contains:

- stable source ID;
- title and publisher;
- canonical URL;
- evidence level;
- last review date;
- a short, manually curated claim summary that may be used in guidance;
- allowed action categories;
- exclusions and cautions.

The initial catalog contains:

1. `who-physical-activity-2020`: World Health Organization guidance on physical activity and reducing sedentary time.
2. `ccohs-working-posture`: Canadian Centre for Occupational Health and Safety guidance that work should permit varied balanced positions and that there is no single uniquely correct posture for extended periods.
3. `swain-posture-lbp-2020`: systematic review of systematic reviews finding no consensus that specific spinal postures cause low back pain.
4. `nice-neurological-referral-ng127`: referral guidance for neurological warning symptoms.
5. `nhs-back-pain-warning-signs`: public-facing urgent warning signs and general advice to remain active when appropriate.

The prompt receives only the curated summaries and IDs. The model output contains source IDs. The server rejects unknown IDs and resolves valid IDs to citation objects from the catalog.

Guidance must distinguish three layers:

- **Observation:** a tentative, non-diagnostic description grounded in named images.
- **Action:** a conservative wellness suggestion supported by at least one evidence source.
- **Limitation:** what cannot be concluded from sequential monocular images.

## 7. Model pipeline

### 7.1 Provider abstraction

Provider selection is derived from server configuration:

- Yibu base URL plus `qwen3.5-omni-plus` -> `omni`;
- OpenRouter base URL -> `development-fallback`;
- missing key -> `unconfigured`;
- any other endpoint -> `development-fallback` unless explicitly mapped and tested.

The client uses one stable application contract regardless of provider. Provider-specific request construction remains inside the API workspace.

### 7.2 Analysis call

One multimodal analysis call receives all four images, the actual audio, capture context, the evidence summaries, and strict output instructions. The preferred Qwen payload represents the ordered stills as one visual sequence and the recording as the audio modality in the same conversation context. The OpenRouter adapter sends the equivalent supported multimodal content.

The analysis request asks for text-only structured JSON. It must return:

- a short summary;
- zero to three tentative observations;
- one to three conservative actions;
- limitations;
- recognized safety signal IDs;
- evidence source IDs.

The response is parsed with Zod. Invalid JSON, unknown source IDs, unsupported numerical claims, forbidden diagnostic language, or an invalid shape causes a validation failure rather than reaching the user.

### 7.3 Speech call

After validation and deterministic safety handling, the server builds a short narration from the accepted report. When native audio is enabled, a second request asks the same configured OMNI model to speak exactly that narration. This prevents spoken content from diverging from the validated captions.

The development fallback does not synthesize speech. It returns the validated report with `speechProvider: "none"`.

### 7.4 Streaming

The provider adapter consumes required upstream streaming formats, including OMNI audio chunks. The first implementation returns one validated application response because safety and citation validation must complete before user-visible content is released. A later transport-only enhancement may stream validated narration events without changing the report schema.

## 8. Safety policy

The language model detects possible safety signals from the spoken question, but it does not decide final safety copy. The server maps recognized identifiers to deterministic messages and severity.

Initial urgent signals include:

- new bladder or bowel control changes with back symptoms;
- new saddle-area numbness;
- rapidly worsening or bilateral limb weakness or numbness;
- severe symptoms following significant trauma;
- chest pain mentioned with back symptoms.

The urgent response instructs the user to seek urgent local medical assessment. It does not name a diagnosis. Less acute persistent pain, recurring numbness, progressive weakness, or functional limitation maps to professional assessment rather than posture coaching.

When a safety response is active:

- it appears before wellness actions;
- wellness actions are omitted if they could distract from escalation;
- the model cannot downgrade the server-selected severity;
- the response states that Align cannot assess the cause.

Every ordinary report includes these limitations:

- sequential phone images are not a clinical examination;
- appearance does not establish pain causality;
- no diagnosis or verified angle was produced;
- users should stop an action that causes pain, dizziness, numbness, or weakness.

## 9. State and persistence

`ScanContext` gains `guidanceReport` and setter/reset support. `SavedSession` stores the structured report rather than only a caption. SQLite migration is additive: retain `coach_caption` for existing rows and add nullable `guidance_json`. Existing saved sessions continue to load.

Raw recordings and temporary analysis frames are deleted after every request outcome. Saved scan images remain local under the existing consent and storage behavior.

## 10. Reliability and observability

- Active requests are keyed by scan ID rather than the global `local` key.
- Rate limiting is keyed by access token or a bounded client identifier instead of one global array.
- Abort, timeout, provider HTTP failure, invalid provider response, and evidence validation failure have different internal categories and stable client codes.
- Logs contain request ID, provider mode, model, status category, latency, image count, and whether audio was returned. They never contain media, transcript text, model output, or secrets.
- The health route reports configuration truthfully but does not make a live paid provider call.
- A dedicated smoke command performs a real four-image-plus-audio request. Its output labels the provider mode and fails if an OMNI-required smoke run reaches the fallback.

## 11. Testing strategy

Implementation follows test-driven development.

### Unit tests

- provider classification and truthful health payloads;
- evidence catalog integrity and unique source IDs;
- model prompt contains all view labels, evidence IDs, and safety constraints;
- provider payload contains four ordered images and actual audio;
- structured response parsing rejects unknown citations, diagnostics, and invented numbers;
- deterministic safety severity cannot be downgraded;
- narration contains only validated report content;
- legacy saved sessions migrate without data loss.

### API integration tests

- valid multipart request returns the structured application contract using a fake upstream provider;
- missing, duplicate, oversized, or incorrectly typed media is rejected;
- provider timeouts and malformed responses produce stable errors;
- simultaneous scan IDs do not cancel each other;
- a new request for the same scan ID cancels the old request;
- fallback mode is returned as fallback, never OMNI.

### Client tests

- the fourth capture enters the final-question state;
- successful guidance is stored before navigation to recap;
- skip and failure paths preserve all captures;
- reset removes the report;
- saving and loading retains citations and safety state.

### Live verification

Before claiming the development path works:

- run the full repository tests and build;
- run a real OpenRouter four-image-plus-audio smoke request and record model/latency;
- run the flow on the available iPhone or simulator.

Before claiming sponsor readiness:

- configure the approved Yibu key;
- verify the exact model returned by the provider;
- run the same smoke request with OMNI-required mode;
- verify native audio or disclose caption-only degradation;
- complete the physical-device capture-to-guidance-to-save flow.

## 12. Acceptance criteria

The implementation is accepted when:

1. A user can complete four captures, record one spoken goal, receive a structured sourced report, and save it without leaving the guided flow.
2. The development fallback handles all four images and the actual audio but is visibly and programmatically labeled as a fallback.
3. Switching to Yibu requires environment changes only.
4. Every action cites at least one registered evidence source.
5. The server rejects unsupported citations, diagnostic language, and invented numerical findings.
6. Urgent signals trigger deterministic escalation language.
7. Provider failure does not discard captures or prevent local saving.
8. Tests cover contracts, safety, evidence, multipart validation, provider behavior, persistence, and the client transition.
9. Current test and build commands pass.
10. No UI redesign or native pose implementation is required for this milestone.
