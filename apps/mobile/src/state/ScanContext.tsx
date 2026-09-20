import { createContext, useCallback, useContext, useMemo, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from "react";
import type { GuidanceReport, Measurement, ViewId } from "@align/contracts";
import type { Captures } from "../lib/captureFlow";
import { discardCaptures } from "../services/captures";

type ScanState = {
  scanId: string;
  captures: Captures;
  cloudCoachEnabled: boolean;
  coachCaption: string;
  guidanceReport: GuidanceReport | null;
  measurements: Measurement[];
  setCapture: (view: ViewId, uri: string) => void;
  setCloudCoachEnabled: (enabled: boolean) => void;
  setCoachCaption: (caption: string) => void;
  setGuidanceReport: (report: GuidanceReport | null) => void;
  setMeasurements: Dispatch<SetStateAction<Measurement[]>>;
  reset: () => void;
};

const ScanContext = createContext<ScanState | null>(null);
const newId = () => `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function ScanProvider({ children }: PropsWithChildren) {
  const [scanId, setScanId] = useState(newId);
  const [captures, setCaptures] = useState<Captures>({});
  const [cloudCoachEnabled, setCloudCoachEnabled] = useState(true);
  const [coachCaption, setCoachCaption] = useState("");
  const [guidanceReport, setGuidanceReport] = useState<GuidanceReport | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const setCapture = useCallback((view: ViewId, uri: string) => {
    setCaptures((current) => ({ ...current, [view]: uri }));
  }, []);

  const value = useMemo<ScanState>(() => ({
    scanId,
    captures,
    cloudCoachEnabled,
    coachCaption,
    guidanceReport,
    measurements,
    setCapture,
    setCloudCoachEnabled,
    setCoachCaption,
    setGuidanceReport,
    setMeasurements,
    reset: () => {
      void discardCaptures(captures);
      setScanId(newId());
      setCaptures({});
      setCoachCaption("");
      setGuidanceReport(null);
      setMeasurements([]);
    },
  }), [captures, cloudCoachEnabled, coachCaption, guidanceReport, measurements, scanId, setCapture]);

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan() {
  const value = useContext(ScanContext);
  if (!value) throw new Error("useScan must be used within ScanProvider");
  return value;
}
