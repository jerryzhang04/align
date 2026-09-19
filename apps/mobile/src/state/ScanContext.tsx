import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import type { ViewId } from "@align/contracts";
import type { Captures } from "../lib/captureFlow";
import { discardCaptures } from "../services/captures";

type ScanState = {
  scanId: string;
  captures: Captures;
  cloudCoachEnabled: boolean;
  coachCaption: string;
  setCapture: (view: ViewId, uri: string) => void;
  setCloudCoachEnabled: (enabled: boolean) => void;
  setCoachCaption: (caption: string) => void;
  reset: () => void;
};

const ScanContext = createContext<ScanState | null>(null);
const newId = () => `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function ScanProvider({ children }: PropsWithChildren) {
  const [scanId, setScanId] = useState(newId);
  const [captures, setCaptures] = useState<Captures>({});
  const [cloudCoachEnabled, setCloudCoachEnabled] = useState(true);
  const [coachCaption, setCoachCaption] = useState("");

  const value = useMemo<ScanState>(() => ({
    scanId,
    captures,
    cloudCoachEnabled,
    coachCaption,
    setCapture: (view, uri) => setCaptures((current) => ({ ...current, [view]: uri })),
    setCloudCoachEnabled,
    setCoachCaption,
    reset: () => {
      void discardCaptures(captures);
      setScanId(newId());
      setCaptures({});
      setCoachCaption("");
    },
  }), [captures, cloudCoachEnabled, coachCaption, scanId]);

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan() {
  const value = useContext(ScanContext);
  if (!value) throw new Error("useScan must be used within ScanProvider");
  return value;
}
