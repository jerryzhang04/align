type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 60_000, fetchImpl: FetchLike = fetch) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new Error("request_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abort);
  }
}

export function coachErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "unauthorized") return "The server connection has expired. Reload Align or reopen it from the current development QR code.";
  if (code === "omni_not_configured" || code === "guidance_not_configured") return "The coach provider is not configured on the server. Your photos remain on this iPhone.";
  if (code === "request_timeout" || code === "cancelled") return "The coach took too long. Your photos are safe; tap to record and retry.";
  if (code === "rate_limited") return "The coach is receiving too many requests. Wait a minute, then try again.";
  if (code === "invalid_image") return "The camera image is too large to send. Return to setup and try the scan again.";
  if (code === "invalid_audio" || code === "missing_recording") return "The recording could not be read. Record a short question and try again.";
  if (code === "guidance_invalid") return "The coach response could not be verified. Your photos are safe; try describing your goal again.";
  if (code === "omni_failed" || code === "guidance_failed") return "The coaching provider could not respond. Your photos are safe; try again shortly.";
  return "Could not reach the coach. Keep the Mac server running and both devices on the same Wi-Fi, then retry.";
}
