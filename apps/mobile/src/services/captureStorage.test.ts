import { describe, expect, it } from "vitest";
import type { ViewId } from "@align/contracts";
import { createCaptureStorage, type CaptureFile, type CaptureFiles } from "./captureStorage";

class MemoryFile implements CaptureFile {
  constructor(readonly uri: string, private readonly files: Set<string>) {}

  get exists() {
    return this.files.has(this.uri);
  }

  delete() {
    if (!this.exists) throw new Error(`Missing ${this.uri}`);
    this.files.delete(this.uri);
  }
}

function fixture() {
  const files = new Set(["tmp://camera.jpg"]);
  const file = (uri: string) => new MemoryFile(uri, files);
  const storage = createCaptureStorage({
    file,
    staged: (scanId: string, view: ViewId) => file(`cache://${scanId}-${view}.jpg`),
    persisted: (scanId: string, view: ViewId) => file(`document://${scanId}-${view}.jpg`),
    copy: async (source, destination) => {
      if (!source.exists) throw new Error(`Missing ${source.uri}`);
      files.add(destination.uri);
    },
  });
  return { files, storage };
}

describe("capture storage", () => {
  it("stages a new capture in disposable cache until the user saves", async () => {
    const { files, storage } = fixture();

    const uri = await storage.stage("scan-1", "front", "tmp://camera.jpg");

    expect(uri).toBe("cache://scan-1-front.jpg");
    expect(files.has("cache://scan-1-front.jpg")).toBe(true);
    expect(files.has("document://scan-1-front.jpg")).toBe(false);
  });

  it("promotes every capture only when saving succeeds", async () => {
    const { files, storage } = fixture();
    const staged: CaptureFiles = { front: await storage.stage("scan-1", "front", "tmp://camera.jpg") };

    const saved = await storage.finalize("scan-1", staged, async (persistent) => {
      expect(persistent.front).toBe("document://scan-1-front.jpg");
      expect(files.has("cache://scan-1-front.jpg")).toBe(true);
    });

    expect(saved.front).toBe("document://scan-1-front.jpg");
    expect(files.has("document://scan-1-front.jpg")).toBe(true);
    expect(files.has("cache://scan-1-front.jpg")).toBe(false);
  });

  it("removes durable copies and keeps staged captures when saving fails", async () => {
    const { files, storage } = fixture();
    const staged: CaptureFiles = { front: await storage.stage("scan-1", "front", "tmp://camera.jpg") };

    await expect(storage.finalize("scan-1", staged, async () => {
      throw new Error("database unavailable");
    })).rejects.toThrow("database unavailable");

    expect(files.has("cache://scan-1-front.jpg")).toBe(true);
    expect(files.has("document://scan-1-front.jpg")).toBe(false);
  });

  it("discards abandoned captures without failing on already-missing files", async () => {
    const { files, storage } = fixture();
    files.add("cache://scan-1-front.jpg");

    await storage.discard({ front: "cache://scan-1-front.jpg", back: "cache://missing.jpg" });

    expect(files.has("cache://scan-1-front.jpg")).toBe(false);
  });
});
