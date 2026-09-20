export type VoiceInteractionState = {
  preparing: boolean;
  recording: boolean;
  busy: boolean;
};

export type VoiceButtonAction = "start" | "finish" | "none";

export function voiceButtonAction(state: VoiceInteractionState): VoiceButtonAction {
  if (state.preparing || state.busy) return "none";
  return state.recording ? "finish" : "start";
}
