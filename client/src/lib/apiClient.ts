export const DEFAULT_API_TIMEOUT_MS = 70_000;

export class ApiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `Yêu cầu quá thời gian (${Math.round(timeoutMs / 1000)} giây). `
      + "Hãy thử lại.",
    );
    this.name = "ApiTimeoutError";
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_API_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort();
  init.signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new ApiTimeoutError(timeoutMs);
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", forwardAbort);
  }
}
