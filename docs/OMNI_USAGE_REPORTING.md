# OMNI sponsored-usage reporting

The Huawei OMNI Live organizers require a token-usage report for the sponsored
YibuAPI key. **Calls made by this application must be logged too** — running
their Python examples does not capture them.

**Deadline: September 20, 2026, 11:59 PM EDT (America/Toronto).**

## How logging works here

`apps/api/src/usageLog.ts` appends one JSONL record per upstream call to
`artifacts/yibu_api_calls.jsonl`, matching the organizers' `yibu_call_audit_v1`
schema so their `summarize_usage.py` can read our ledger directly. Verified.

Logging is active only when `OMNI_BASE_URL` points at `yibuapi.com`. The
application rejects other providers before making an upstream request.

Recorded per call: call ID, timestamps, model, key suffix (last four characters only),
purpose, endpoint, transport, success/failure, status, latency, and normalized
token counts with the raw usage object. Analysis and speech calls are both
logged, including failures.

Never recorded: prompts, response text, images, audio, or the full API key.

Set a different purpose label with `OMNI_PURPOSE` (default `posture_coaching`).
Override the ledger location with `YIBU_AUDIT_LOG`.

`artifacts/` is gitignored. Keep the ledger; do not commit or publish it.

## Generating the report

The summarizer is the organizers' own tool, from
`yibuapi_examples_20260918_v01.tar.gz` (linked in the approval email).

```bash
tar -xzf yibuapi_examples_20260918_v01.tar.gz
python3 yibuapi_examples_20260918_v01/summarize_usage.py \
  --log "$(pwd)/artifacts/yibu_api_calls.jsonl" \
  --out-dir "$(pwd)/artifacts/summary"
```

That writes `artifacts/summary/usage_summary.json` and
`artifacts/summary/usage_by_model_key_purpose.csv`.

## Before sending

Reply to the approval email and attach both summary files. Include team name,
members, project link, the application email, the reporting period, and the key
suffix shown in the local ledger.

Check these before attaching:

- `source.path` in the JSON is an absolute local path and reveals a username.
  Redact it in the copy you send and say that you did.
- `usage_raw` holds provider-supplied data; `error` can hold failure details.
- Remove any quoted API key from the reply.
- Disclose any gap in coverage: calls made before logging existed, calls made
  through the Python examples with their own ledger, or any other ledger file.

Do not put the full key, the `.env`, raw prompts, or media in the report or in
any public repository, issue, or pull request.

## Coverage note

Keep the local ledger from the first sponsored-key call onward. Disclose any
calls made outside the application or before logging was enabled.
