import { File, Paths } from "expo-file-system";
import type { ViewId } from "@align/contracts";
import type { Captures } from "../lib/captureFlow";
import { createCaptureStorage } from "./captureStorage";

const storage = createCaptureStorage({
  file: (uri) => new File(uri),
  staged: (scanId, view) => new File(Paths.cache, `${scanId}-${view}.jpg`),
  persisted: (scanId, view) => new File(Paths.document, `${scanId}-${view}.jpg`),
  copy: async (source, destination) => {
    await new File(source.uri).copy(new File(destination.uri), { overwrite: true });
  },
});

export async function persistCapture(scanId: string, view: ViewId, temporaryUri: string) {
  return storage.stage(scanId, view, temporaryUri);
}

export async function finalizeCaptures(
  scanId: string,
  captures: Captures,
  save: (persistent: Captures) => Promise<void>,
) {
  return storage.finalize(scanId, captures, save);
}

export async function discardCaptures(captures: Captures) {
  await storage.discard(captures);
}

export async function discardLocalFiles(...uris: (string | null | undefined)[]) {
  const files = Object.fromEntries(uris.filter(Boolean).map((uri, index) => [String(index), uri])) as Captures;
  await storage.discard(files);
}
