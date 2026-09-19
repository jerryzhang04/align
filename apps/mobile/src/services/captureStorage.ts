import type { ViewId } from "@align/contracts";
import type { Captures } from "../lib/captureFlow";

export type CaptureFiles = Captures;

export type CaptureFile = {
  readonly uri: string;
  readonly exists: boolean;
  delete: () => void;
};

type CaptureFileSystem = {
  file: (uri: string) => CaptureFile;
  staged: (scanId: string, view: ViewId) => CaptureFile;
  persisted: (scanId: string, view: ViewId) => CaptureFile;
  copy: (source: CaptureFile, destination: CaptureFile) => Promise<void>;
};

export function createCaptureStorage(fileSystem: CaptureFileSystem) {
  const discard = async (captures: CaptureFiles) => {
    for (const uri of Object.values(captures)) {
      if (!uri) continue;
      const file = fileSystem.file(uri);
      if (file.exists) file.delete();
    }
  };

  return {
    async stage(scanId: string, view: ViewId, temporaryUri: string) {
      const source = fileSystem.file(temporaryUri);
      const destination = fileSystem.staged(scanId, view);
      await fileSystem.copy(source, destination);
      return destination.uri;
    },

    async finalize(
      scanId: string,
      captures: CaptureFiles,
      save: (persistent: CaptureFiles) => Promise<void>,
    ) {
      const persistent: CaptureFiles = {};
      try {
        for (const [view, uri] of Object.entries(captures) as [ViewId, string][]) {
          const destination = fileSystem.persisted(scanId, view);
          await fileSystem.copy(fileSystem.file(uri), destination);
          persistent[view] = destination.uri;
        }
        await save(persistent);
      } catch (error) {
        await discard(persistent);
        throw error;
      }
      await discard(captures);
      return persistent;
    },

    discard,
  };
}
