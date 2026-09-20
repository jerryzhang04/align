import { openDatabaseAsync } from "expo-sqlite";
import { guidanceReportSchema, type GuidanceReport } from "@align/contracts";
import type { Captures } from "../lib/captureFlow";

export type SavedSession = {
  id: string;
  createdAt: string;
  captures: Captures;
  coachCaption: string;
  guidanceReport: GuidanceReport | null;
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
  return db;
}

export async function saveSession(session: SavedSession) {
  const db = await database();
  const persistedGuidance = session.guidanceReport
    ? { ...session.guidanceReport, audioBase64: undefined, audioMime: undefined }
    : null;
  await db.runAsync(
    "INSERT OR REPLACE INTO sessions (id, created_at, captures_json, coach_caption, guidance_json) VALUES (?, ?, ?, ?, ?)",
    session.id,
    session.createdAt,
    JSON.stringify(session.captures),
    session.coachCaption,
    persistedGuidance ? JSON.stringify(persistedGuidance) : null,
  );
}

export async function listSessions(limit = 4): Promise<SavedSession[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ id: string; created_at: string; captures_json: string; coach_caption: string; guidance_json: string | null }>(
    "SELECT id, created_at, captures_json, coach_caption, guidance_json FROM sessions ORDER BY created_at DESC LIMIT ?",
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    captures: JSON.parse(row.captures_json) as Captures,
    coachCaption: row.coach_caption,
    guidanceReport: parseGuidance(row.guidance_json),
  }));
}
