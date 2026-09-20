import type { ProviderMode } from "@align/contracts";
import type { OmniTurnResult } from "./omni.js";

export type SpeechProvider = "omni" | "none";

export type VoicedCoachResult = OmniTurnResult & {
  speechProvider: SpeechProvider;
};

/**
 * OMNI is the only speech source. If OMNI returned native audio, play it.
 * Otherwise the client shows captions. No second TTS vendor is permitted.
 */
export function attachCoachVoice(omni: OmniTurnResult, mode: ProviderMode = "omni"): VoicedCoachResult {
  return { ...omni, speechProvider: omni.audioBase64 && mode === "omni" ? "omni" : "none" };
}
