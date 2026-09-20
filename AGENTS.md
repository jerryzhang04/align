# Align — agent working agreement

Multiple AI agents (Claude, Codex) and multiple humans work this repo at the
same time. These are the constraints that are **load-bearing and not obvious
from reading the code**. Breaking one usually fails silently.

## Hard constraints

**1. OMNI is the only speech vendor.**
No ElevenLabs, no second TTS/STT provider. If OMNI returns audio, play it;
otherwise show captions. Never present another vendor's voice as OMNI. The
`speechProvider` enum in `packages/contracts` is `"omni" | "none"` — it rejects
anything else on purpose, so a reintroduction fails loudly at the boundary.
An earlier commit added ElevenLabs and it was deliberately reverted.

**2. `input_audio.data` encoding is per-provider. Do not "simplify" it.**
In `apps/api/src/omni.ts`, `encodeAudioData()` branches by host. This looks
redundant. It is not, and both branches were verified against live endpoints:

| Provider | `input_audio.data` | Wrong value gives |
| --- | --- | --- |
| YibuAPI / Qwen Omni | `data:audio/wav;base64,...` | `400 InvalidParameter: The provided URL does not appear to be valid` |
| OpenAI / OpenRouter | raw base64 | `400 Provider returned error` |

YibuAPI's form matches the organizers' own `yibu_http.py`. Images use a
`data:` URI for **both**; only audio differs.

**3. Sponsored usage logging is a competition requirement with a deadline.**
`logTurn()` in `omni.ts` and `apps/api/src/usageLog.ts` are not debug helpers.
The OMNI Live organizers require every call our application makes to be logged,
and the report is due 2026-09-20 23:59 EDT. Do not remove the logging when
refactoring `omni.ts`. Records must keep matching their `yibu_call_audit_v1`
schema — their `summarize_usage.py` parses our ledger directly. See
`docs/OMNI_USAGE_REPORTING.md`.

**4. Never commit secrets or the usage ledger.**
`.env` and `artifacts/` are gitignored. The full API key must not appear in the
repo, a commit, a log, a report, or `EXPO_PUBLIC_*`. Only a four-character key
suffix is ever recorded.

**5. The metric engine owns every number.**
`packages/metrics` is the single source of measurements. OMNI explains supplied
measurements; it must never create, modify, accept, or reject one. Do not build
a second scoring system for native pose — reuse `packages/metrics`.

**6. No diagnosis, no invented precision.**
Screening language only. No disease names, no Cobb angles, no millimetres from
a monocular camera, no "medically perfect" score. If it was not measured, do not
say it. See `docs/BUILD_SPEC.md` §7.

## Provider configuration

```bash
npm run omni:use                 # show current profile
npm run omni:use -- omni <key>   # sponsor YibuAPI (the only valid track config)
npm run omni:use -- openrouter <key>  # development fallback, NOT OMNI
npm run omni:models              # list models the endpoint actually exposes
npm run omni:smoke               # real image+audio turn through /v1/coach/turn
```

`omni:smoke` boots its own API on port 8799 so it never collides with
`npm run iphone`. Sponsored usage is logged only when `OMNI_BASE_URL` points at
`yibuapi.com`, so fallback calls are never mislabelled.

The sponsored key enables five models: `qwen3.5-omni-flash`,
`qwen3.5-omni-plus`, `qwen3.5-omni-plus-realtime`, `qwen3.8-omni-flash`,
`gemini-3.1-flash-live-preview`. Code that treats `qwen3.5-omni-plus` as the
only real-OMNI model will misclassify the other four.

## Working alongside other agents

- Check `git status` before editing; another agent may be mid-refactor.
- Prefer new files over edits to a file another agent has open.
- Do not `git add -A`. Stage your own files so history stays attributable.
- Do not kill processes you did not start — `npm run iphone` holds port 8788.
- Verify with `npm test` and `npm run build` before committing; both must pass.
