export function recordingErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const combined = message.toLowerCase();
  if (/denied|permission|not authorized|undetermined/.test(combined)) {
    return "Microphone access is needed to ask the coach. You can enable it in iOS Settings.";
  }
  if (/audio session|session activat|already recording|preparing|busy|in use|category/.test(combined)) {
    return "The microphone could not start because another audio session is active. Pause a moment, then try again.";
  }
  if (message.trim()) {
    return `The microphone could not start (${message}). Try again in a moment.`;
  }
  return "The microphone could not start. Try again in a moment.";
}

export function permissionDeniedMessage(granted: boolean) {
  if (granted) return "";
  return "Microphone access is needed to ask the coach. You can enable it in iOS Settings.";
}
