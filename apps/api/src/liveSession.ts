import type { ViewId } from "@align/contracts";

export type CoarseOrientation = {
  yaw?: number;
  pitch?: number;
  roll?: number;
};

export type LiveFrameSample = {
  scanId: string;
  timestampMs: number;
  imageBase64: string;
  imageMime: string;
  view: ViewId;
  orientation?: CoarseOrientation;
  /** A capture-side signature, when available, avoids image decoding on the API. */
  fingerprint?: string;
};

export type AddFrameResult = {
  accepted: boolean;
  replaced: boolean;
  frameCount: number;
};

export type LiveSessionOptions = {
  maxFramesPerScan?: number;
  maxFramesForTurn?: number;
  dedupeWindowMs?: number;
  sessionTtlMs?: number;
  now?: () => number;
};

type StoredFrame = LiveFrameSample & { metadataKey: string };
type ScanSession = { frames: StoredFrame[]; lastActivityMs: number; phase: "open" | "finalizing" };

const DEFAULT_MAX_FRAMES_PER_SCAN = 20;
const DEFAULT_MAX_FRAMES_FOR_TURN = 4;
const DEFAULT_DEDUPE_WINDOW_MS = 750;
const DEFAULT_SESSION_TTL_MS = 5 * 60 * 1_000;

function boundedPositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("live_session_invalid_limit");
  return value;
}

function boundedNonNegative(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("live_session_invalid_duration");
  return value;
}

function assertFrame(sample: LiveFrameSample): void {
  if (!sample.scanId.trim()) throw new Error("live_session_scan_id_required");
  if (!Number.isSafeInteger(sample.timestampMs) || sample.timestampMs < 0) {
    throw new Error("live_session_timestamp_required");
  }
  if (sample.imageMime.toLowerCase() !== "image/jpeg") throw new Error("live_session_jpeg_required");
  if (!sample.imageBase64) throw new Error("live_session_frame_required");
}

function orientationKey(orientation?: CoarseOrientation): string {
  if (!orientation) return "unknown";
  const round = (value: number | undefined) => (Number.isFinite(value) ? Math.round((value ?? 0) * 2) / 2 : "unknown");
  return `${round(orientation.yaw)}:${round(orientation.pitch)}:${round(orientation.roll)}`;
}

/**
 * A stable, deliberately cheap fallback signature. It is capture metadata, not
 * image analysis: the API never decodes JPEG data to decide whether to retain a
 * sample. Capture clients may provide a stronger fingerprint themselves.
 */
function metadataKey(sample: LiveFrameSample): string {
  const provided = sample.fingerprint?.trim();
  if (provided) return `${sample.view}|${provided}|${orientationKey(sample.orientation)}`;
  const prefix = sample.imageBase64.slice(0, 32);
  const suffix = sample.imageBase64.slice(-32);
  return `${sample.view}|${sample.imageMime}|${sample.imageBase64.length}|${prefix}|${suffix}|${orientationKey(sample.orientation)}`;
}

function publicFrame(frame: StoredFrame): LiveFrameSample {
  return {
    scanId: frame.scanId,
    timestampMs: frame.timestampMs,
    imageBase64: frame.imageBase64,
    imageMime: frame.imageMime,
    view: frame.view,
    ...(frame.orientation ? { orientation: { ...frame.orientation } } : {}),
    ...(frame.fingerprint ? { fingerprint: frame.fingerprint } : {}),
  };
}

/** Keeps short-lived per-scan camera samples until an OMNI turn consumes them. */
export class LiveSessionStore {
  private readonly sessions = new Map<string, ScanSession>();
  private readonly closedUntil = new Map<string, number>();
  private readonly maxFramesPerScan: number;
  private readonly maxFramesForTurn: number;
  private readonly dedupeWindowMs: number;
  private readonly sessionTtlMs: number;
  private readonly clock: () => number;

  constructor(options: LiveSessionOptions = {}) {
    this.maxFramesPerScan = boundedPositiveInteger(options.maxFramesPerScan, DEFAULT_MAX_FRAMES_PER_SCAN);
    this.maxFramesForTurn = Math.min(
      boundedPositiveInteger(options.maxFramesForTurn, DEFAULT_MAX_FRAMES_FOR_TURN),
      this.maxFramesPerScan,
    );
    this.dedupeWindowMs = boundedNonNegative(options.dedupeWindowMs, DEFAULT_DEDUPE_WINDOW_MS);
    this.sessionTtlMs = boundedNonNegative(options.sessionTtlMs, DEFAULT_SESSION_TTL_MS);
    this.clock = options.now ?? Date.now;
  }

  addFrame(sample: LiveFrameSample): AddFrameResult {
    assertFrame(sample);
    this.expire();

    const now = this.clock();
    if ((this.closedUntil.get(sample.scanId) ?? 0) > now) throw new Error("live_session_not_accepting");
    const existingSession = this.sessions.get(sample.scanId);
    if (existingSession?.phase === "finalizing") throw new Error("live_session_not_accepting");
    const session = existingSession ?? { frames: [], lastActivityMs: now, phase: "open" as const };
    const key = metadataKey(sample);
    const matchingIndex = session.frames.findIndex(
      (existing) => existing.metadataKey === key && Math.abs(existing.timestampMs - sample.timestampMs) <= this.dedupeWindowMs,
    );

    if (matchingIndex >= 0) {
      const existing = session.frames[matchingIndex];
      session.lastActivityMs = now;
      if (existing.timestampMs > sample.timestampMs) {
        this.sessions.set(sample.scanId, session);
        return { accepted: false, replaced: false, frameCount: session.frames.length };
      }
      session.frames[matchingIndex] = { ...sample, orientation: sample.orientation ? { ...sample.orientation } : undefined, metadataKey: key };
      session.frames.sort((a, b) => a.timestampMs - b.timestampMs);
      this.sessions.set(sample.scanId, session);
      return { accepted: true, replaced: true, frameCount: session.frames.length };
    }

    session.frames.push({ ...sample, orientation: sample.orientation ? { ...sample.orientation } : undefined, metadataKey: key });
    session.frames.sort((a, b) => a.timestampMs - b.timestampMs);
    if (session.frames.length > this.maxFramesPerScan) session.frames.splice(0, session.frames.length - this.maxFramesPerScan);
    session.lastActivityMs = now;
    this.sessions.set(sample.scanId, session);
    return { accepted: true, replaced: false, frameCount: session.frames.length };
  }

  /** Returns temporally distributed frames in chronological order for one turn. */
  selectFrames(scanId: string, maxFrames = this.maxFramesForTurn): LiveFrameSample[] {
    this.expire();
    const frames = this.sessions.get(scanId)?.frames ?? [];
    const limit = Math.min(boundedPositiveInteger(maxFrames, this.maxFramesForTurn), this.maxFramesForTurn, frames.length);
    if (limit === 0) return [];
    if (frames.length <= limit) return frames.map(publicFrame);
    if (limit === 1) return [publicFrame(frames[frames.length - 1])];

    const chosen: StoredFrame[] = [];
    for (let position = 0; position < limit; position += 1) {
      const index = Math.round((position * (frames.length - 1)) / (limit - 1));
      chosen.push(frames[index]);
    }
    return chosen.map(publicFrame);
  }

  /** Selects the latest real sample from each requested guided scan phase. */
  selectLatestByView(scanId: string, views: readonly ViewId[]): LiveFrameSample[] {
    this.expire();
    const frames = this.sessions.get(scanId)?.frames ?? [];
    return views.flatMap((view) => {
      const match = [...frames].reverse().find((frame) => frame.view === view);
      return match ? [publicFrame(match)] : [];
    });
  }

  /** Selects the turn inputs then immediately drops the session's retained data. */
  finalize(scanId: string, maxFrames = this.maxFramesForTurn): LiveFrameSample[] {
    const frames = this.selectFrames(scanId, maxFrames);
    this.close(scanId);
    return frames;
  }

  /** Prevents new uploads while a provider turn is using this session. */
  beginFinalize(scanId: string): boolean {
    this.expire();
    const session = this.sessions.get(scanId);
    if (!session || session.phase !== "open") return false;
    session.phase = "finalizing";
    session.lastActivityMs = this.clock();
    return true;
  }

  /** Reopens retained frames only when the same provider turn failed. */
  reopen(scanId: string): boolean {
    const session = this.sessions.get(scanId);
    if (!session || session.phase !== "finalizing") return false;
    session.phase = "open";
    session.lastActivityMs = this.clock();
    return true;
  }

  /** Discards frames and temporarily tombstones the id against late uploads. */
  close(scanId: string): boolean {
    const existed = this.sessions.delete(scanId);
    this.closedUntil.set(scanId, this.clock() + this.sessionTtlMs);
    return existed;
  }

  reset(scanId: string): boolean {
    return this.sessions.delete(scanId);
  }

  /** Removes inactive sessions and returns the scan ids that were cleared. */
  expire(now = this.clock()): string[] {
    const expired: string[] = [];
    for (const [scanId, session] of this.sessions) {
      if (now - session.lastActivityMs > this.sessionTtlMs) {
        this.sessions.delete(scanId);
        expired.push(scanId);
      }
    }
    for (const [scanId, until] of this.closedUntil) {
      if (now >= until) this.closedUntil.delete(scanId);
    }
    return expired;
  }
}
