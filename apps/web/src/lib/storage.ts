import type { Measurement, ViewId } from "@align/contracts";
import { DEFINITION_VERSION, POSE_SCHEMA } from "@align/contracts";

export type SavedScan = {
  id: string;
  createdAt: string;
  protocolVersion: string;
  poseSchema: string;
  views: ViewId[];
  measurements: Measurement[];
  notes: string[];
};

const KEY = "align.scans.v1";

export function loadScans(): SavedScan[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedScan[];
  } catch {
    return [];
  }
}

export function saveScan(scan: Omit<SavedScan, "id" | "createdAt" | "protocolVersion" | "poseSchema">): SavedScan {
  const full: SavedScan = {
    ...scan,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    protocolVersion: DEFINITION_VERSION,
    poseSchema: POSE_SCHEMA,
  };
  const next = [full, ...loadScans()].slice(0, 20);
  localStorage.setItem(KEY, JSON.stringify(next));
  return full;
}

export function clearScans() {
  localStorage.removeItem(KEY);
}
