import { openDatabaseAsync } from "expo-sqlite";
import { guidanceReportSchema, measurementSchema, type GuidanceReport, type Measurement } from "@align/contracts";
import type { Captures } from "../lib/captureFlow";
import { discardLocalFiles } from "./captures";

export type SavedSession = {
  id: string;
  createdAt: string;
  captures: Captures;
  coachCaption: string;
  guidanceReport: GuidanceReport | null;
  measurements: Measurement[];
};

function parseGuidance(value: string | null): GuidanceReport | null {
  if (!value) return null;
  try {
    const parsed = guidanceReportSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function parseMeasurements(value: string | null, report: GuidanceReport | null): Measurement[] {
  if (value) {
    try {
      const parsed = measurementSchema.array().safeParse(JSON.parse(value));
      if (parsed.success) return parsed.data;
    } catch {
      // Fall through to report copy.
    }
  }
  return report?.measurements ?? [];
}

async function database() {
  const db = await openDatabaseAsync("align.db");
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      captures_json TEXT NOT NULL,
      coach_caption TEXT NOT NULL DEFAULT ''
    );
  `);
  await db.execAsync("ALTER TABLE sessions ADD COLUMN guidance_json TEXT").catch(() => undefined);
  await db.execAsync("ALTER TABLE sessions ADD COLUMN measurements_json TEXT").catch(() => undefined);
  return db;
}

function mapRow(row: { id: string; created_at: string; captures_json: string; coach_caption: string; guidance_json: string | null; measurements_json: string | null }): SavedSession {
  const guidanceReport = parseGuidance(row.guidance_json);
  return {
    id: row.id,
    createdAt: row.created_at,
    captures: JSON.parse(row.captures_json) as Captures,
    coachCaption: row.coach_caption,
    guidanceReport,
    measurements: parseMeasurements(row.measurements_json, guidanceReport),
  };
}

export async function saveSession(session: SavedSession) {
  const db = await database();
  const persistedGuidance = session.guidanceReport
    ? { ...session.guidanceReport, audioBase64: undefined, audioMime: undefined }
    : null;
  await db.runAsync(
    "INSERT OR REPLACE INTO sessions (id, created_at, captures_json, coach_caption, guidance_json, measurements_json) VALUES (?, ?, ?, ?, ?, ?)",
    session.id,
    session.createdAt,
    JSON.stringify(session.captures),
    session.coachCaption,
    persistedGuidance ? JSON.stringify(persistedGuidance) : null,
    JSON.stringify(session.measurements),
  );
}

export async function listSessions(limit = 20): Promise<SavedSession[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ id: string; created_at: string; captures_json: string; coach_caption: string; guidance_json: string | null; measurements_json: string | null }>(
    "SELECT id, created_at, captures_json, coach_caption, guidance_json, measurements_json FROM sessions ORDER BY created_at DESC LIMIT ?",
    limit,
  );
  return rows.map(mapRow);
}

export async function getSession(id: string): Promise<SavedSession | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ id: string; created_at: string; captures_json: string; coach_caption: string; guidance_json: string | null; measurements_json: string | null }>(
    "SELECT id, created_at, captures_json, coach_caption, guidance_json, measurements_json FROM sessions WHERE id = ?",
    id,
  );
  return row ? mapRow(row) : null;
}

export async function deleteSession(id: string) {
  const session = await getSession(id);
  const db = await database();
  await db.runAsync("DELETE FROM sessions WHERE id = ?", id);
  if (session) await discardLocalFiles(...Object.values(session.captures));
}
