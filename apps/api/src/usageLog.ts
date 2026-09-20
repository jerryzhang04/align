/**
 * Append-only token accounting for sponsored YibuAPI calls.
 *
 * The OMNI Live organizers require every call made by our own application to be
 * logged, not just calls made through their Python examples. Records match the
 * `yibu_call_audit_v1` schema their `summarize_usage.py` consumes, so the two
 * ledgers can be summarized together.
 *
 * Deliberately excluded: prompts, response bodies, media, and the full API key.
 * Only the last four key characters are retained, as their logger does.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export const AUDIT_SCHEMA_VERSION = "yibu_call_audit_v1";

export type UsageTotals = {
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  usage_reported: boolean;
  total_tokens_derived: boolean;
  usage_raw: Record<string, unknown>;
};

export type AuditInput = {
  model: string;
  apiKey: string;
  endpoint: string;
  purpose: string;
  transport: string;
  ok: boolean;
  latencySeconds: number;
  responseJson?: Record<string, unknown> | null;
  statusCode?: number | null;
  error?: string | null;
  callId?: string;
};

function integer(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function firstInteger(usage: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = integer(usage[key]);
    if (value !== null) return value;
  }
  return null;
}

/**
 * Normalize the token field variants returned by supported Yibu transports.
 * Missing usage stays null — it must never be recorded as zero.
 */
export function normalizeUsage(responseJson?: Record<string, unknown> | null): UsageTotals {
  const data = responseJson ?? {};
  const nested = data.response as Record<string, unknown> | undefined;
  const candidates = [
    data.usage,
    data.usageMetadata,
    nested?.usage,
    nested?.usageMetadata,
  ];
  const usage = (candidates.find((c) => c && typeof c === "object") ?? {}) as Record<string, unknown>;

  const input = firstInteger(usage, ["prompt_tokens", "promptTokenCount", "inputTokenCount", "input_tokens"]);
  const output = firstInteger(usage, ["completion_tokens", "responseTokenCount", "outputTokenCount", "output_tokens"]);
  let total = firstInteger(usage, ["total_tokens", "totalTokenCount"]);

  let derived = false;
  if (total === null && input !== null && output !== null) {
    total = input + output;
    derived = true;
  }

  return {
    input_tokens: input,
    output_tokens: output,
    total_tokens: total,
    usage_reported: Object.keys(usage).length > 0,
    total_tokens_derived: derived,
    usage_raw: usage,
  };
}

export function keySuffix(apiKey: string): string {
  const value = (apiKey ?? "").trim();
  return value ? `...${value.slice(-4)}` : "[missing]";
}

export function auditLogPath(environment: NodeJS.ProcessEnv = process.env): string {
  const override = (environment.YIBU_AUDIT_LOG ?? "").trim();
  if (override) return override;
  return resolve(process.cwd(), "artifacts", "yibu_api_calls.jsonl");
}

export function buildAuditRecord(input: AuditInput): Record<string, unknown> {
  const usage = normalizeUsage(input.responseJson);
  const record: Record<string, unknown> = {
    schema_version: AUDIT_SCHEMA_VERSION,
    timestamp_utc: new Date().toISOString(),
    timestamp_local: new Date().toString(),
    call_id: input.callId ?? randomUUID().replace(/-/g, ""),
    provider: "yibuapi",
    model: String(input.model),
    key_suffix: keySuffix(input.apiKey),
    purpose: String(input.purpose),
    transport: String(input.transport),
    endpoint: String(input.endpoint),
    ok: Boolean(input.ok),
    status_code: input.statusCode ?? null,
    latency_s: Number(input.latencySeconds.toFixed(4)),
    ...usage,
  };

  if (input.error) {
    // Never let a credential reach the ledger through an error string.
    let text = String(input.error);
    if (input.apiKey) text = text.split(input.apiKey).join("[REDACTED]");
    record.error = text.slice(0, 2000);
  }

  return record;
}

/** Appends one record. Logging must never break a coaching turn, so it throws nothing. */
export function appendAuditRecord(input: AuditInput, environment: NodeJS.ProcessEnv = process.env): Record<string, unknown> | null {
  const record = buildAuditRecord(input);
  try {
    const path = auditLogPath(environment);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    return record;
  } catch (error) {
    console.error("usage_log_failed", error instanceof Error ? error.message : "unknown");
    return null;
  }
}
