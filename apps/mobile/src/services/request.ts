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

function errorCode(error: unknown) {
  if (!(error instanceof Error)) return "";
  if (error.name === "AbortError") return "cancelled";
  if (error.name === "ZodError") return "coach_invalid_response";
  const message = error.message;
  if (/Network request failed|Failed to fetch|fetch failed|ECONNREFUSED|Could not connect/i.test(message)) {
    return "network_failed";
  }
  return message;
}

export function coachErrorMessage(error: unknown) {
  const code = errorCode(error);
  if (code === "unauthorized") return "The server connection has expired. Reload Align or reopen it from the current development QR code.";
  if (code === "omni_not_configured" || code === "guidance_not_configured") return "The coach provider is not configured on the server. Your photos remain on this iPhone.";
  if (code === "request_timeout" || code === "cancelled") return "The coach took too long. Your photos are safe; tap to record and retry.";
  if (code === "rate_limited") return "The coach is receiving too many requests. Wait a minute, then try again.";
  if (code === "invalid_image") return "The camera image is too large to send. Return to setup and try the scan again.";
  if (code === "invalid_audio" || code === "missing_recording") return "The recording could not be read. Record a short question and try again.";
  if (code === "guidance_invalid" || code === "coach_invalid_response") return "The coach response could not be verified. Your photos are safe; try describing your goal again.";
  if (code === "omni_failed" || code === "guidance_failed") return "The coaching provider could not respond. Your photos are safe; try again shortly.";
  if (code === "coach_loopback_url") return "This iPhone cannot reach 127.0.0.1. Start Align with npm run iphone so the API URL is your computer’s Wi-Fi address, then reload.";
  if (code === "network_failed") return "Align cannot reach the coaching API from this iPhone. Keep the API running on port 8788, use the same Wi-Fi as Expo, then reload the app.";
  return `Coach request failed (${code || "unknown"}). Your photos are still on this iPhone.`;
}
