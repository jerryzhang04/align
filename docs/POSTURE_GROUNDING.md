# How Align grounds posture guidance

## What is measured versus generated

- MoveNet estimates landmarks from each submitted photo. `packages/metrics` computes all numeric measurements and confidence limitations.
- OMNI receives the actual ordered photos, verified measurements, and optional spoken question. Both photo-only reports and spoken questions use the provider.
- `apps/api/src/postureReference.ts` attaches relevant qualitative ergonomic references to each measurement. References come from the reviewed citation catalog in `evidence.ts`.
- The report prompt requires each action's rationale to connect to a specific finding/view, visible feature, or the user's stated goal and include a source ID. This is a generation instruction, not proof that every generated rationale is correct.
- The report validator checks structure, recognized references, safety signals, and prohibited claims. It does not establish clinical validity.

## Reference baseline

OSHA's computer-workstation guidance describes comfortable head/neck alignment and relaxed shoulders. CCOHS standing guidance addresses reach, varied positions, and opportunities to sit. These are task-specific qualitative references, not population-derived numerical normal ranges for standing camera measurements.

The existing camera practice scores are heuristic engine outputs. They are not a medically validated baseline and are no longer supplied to the model as a basis for recommendations. No second scoring engine is introduced.

A camera cannot establish the cause of pain, how long a posture is held, a user's habits, or medical history. The model is instructed to ask or acknowledge missing context instead of inventing it. Missing or limited measurements must not become a definitive correction.

## Personalization and fallback

Personalization currently means this submission's images, measurements, limitations, and optional spoken context. There is no longitudinal per-user reference baseline or trained proprietary clinical model. Similar submissions can appropriately receive similar advice; randomly different wording is not personalization.

If OMNI fails, a deterministic measurement-dependent fallback remains available. The UI explicitly labels this as rule-based scan notes, not a personalized OMNI review. Local-only scans also use that fallback.

## Demo claims

Accurate: "We combine measured camera landmarks, curated ergonomic references, and the user's spoken context to ground multimodal coaching."

Do not claim a clinically validated assessment, a unique ideal posture, a learned personal history, or that curated references alone constitute a proven competitive moat.

## Verification

`npm test` and `npm run build` cover reference selection, missing evidence, audio-free analysis, and multipart transport. For a real provider check:

```sh
SMOKE_IMAGE=/path/to/test-person.jpg SMOKE_REQUIRE_POSE=true SMOKE_PHOTO_ONLY=true SMOKE_REQUIRE_OMNI=true npm run omni:smoke
```

The smoke fixture is repeated across view slots and cannot validate correct real-world four-angle capture or clinical accuracy.
