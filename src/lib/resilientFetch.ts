/**
 * Resilient fetch for every Supabase call (Auth, REST, RPC, Storage, Edge Functions).
 *
 * WHY: the SDK uses the raw `fetch`. A hanging connection never resolves, and a
 * transient 502/503/504 or a dropped TCP connection surfaces to the UI as the
 * browser's raw "Load failed" / "Failed to fetch" — which is exactly what was
 * observed during login/signup.
 *
 * WHAT IT DOES (and deliberately does NOT do):
 *  - Applies a per-surface timeout so no request can hang forever.
 *  - Retries ONLY idempotent requests (GET/HEAD) and the auth token-refresh
 *    call, with exponential backoff + jitter, max 2 retries.
 *  - NEVER retries POST/PATCH/PUT/DELETE — writes (invoices, checkout, signup,
 *    Stripe-backed edge functions) must not be duplicated.
 *  - Respects `Retry-After` on 429.
 *  - Emits connectivity events so the UI can show a professional banner.
 *
 * It changes no business logic: on success the response is returned untouched.
 */

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 400;

export type BackendHealth = "ok" | "degraded";

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524]);

let currentHealth: BackendHealth = "ok";
let consecutiveFailures = 0;

function emitHealth(next: BackendHealth) {
  if (next === currentHealth) return;
  currentHealth = next;
  try {
    window.dispatchEvent(new CustomEvent("garageflow:backend-health", { detail: next }));
  } catch {
    /* noop */
  }
}

export function getBackendHealth(): BackendHealth {
  return currentHealth;
}

function timeoutFor(url: string): number {
  if (url.includes("/functions/v1/")) return 30_000;
  if (url.includes("/storage/v1/")) return 60_000;
  if (url.includes("/auth/v1/")) return 15_000;
  return DEFAULT_TIMEOUT_MS;
}

function isIdempotent(url: string, init?: RequestInit): boolean {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return true;
  // Token refresh is safe to repeat: the server returns the same rotated session
  // for the same refresh token within its reuse window, and failing it logs the
  // user out for no reason.
  if (url.includes("grant_type=refresh_token")) return true;
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffDelay(attempt: number, retryAfterHeader?: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 10_000);
  }
  const base = BASE_BACKOFF_MS * 2 ** attempt;
  return base + Math.random() * base * 0.3;
}

export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const timeoutMs = timeoutFor(url);
  const retryable = isIdempotent(url, init);
  const maxAttempts = retryable ? MAX_RETRIES + 1 : 1;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Respect a caller-provided signal (React Query cancellations, etc.).
    const external = init?.signal;
    const onExternalAbort = () => controller.abort();
    if (external) {
      if (external.aborted) controller.abort();
      else external.addEventListener("abort", onExternalAbort, { once: true });
    }

    try {
      const response = await fetch(input, { ...init, signal: controller.signal });

      if (retryable && RETRYABLE_STATUS.has(response.status) && attempt < maxAttempts - 1) {
        await sleep(backoffDelay(attempt, response.headers.get("Retry-After")));
        continue;
      }

      // 5xx still counts as a degraded backend even when we cannot retry.
      if (response.status >= 500) {
        consecutiveFailures++;
        if (consecutiveFailures >= 2) emitHealth("degraded");
      } else {
        consecutiveFailures = 0;
        emitHealth("ok");
      }
      return response;
    } catch (error) {
      lastError = error;
      const aborted = external?.aborted;
      if (aborted) throw error; // caller cancelled on purpose — never retry
      const isTimeout = (error as Error)?.name === "AbortError";
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;

      if (!offline && retryable && attempt < maxAttempts - 1) {
        await sleep(backoffDelay(attempt));
        continue;
      }

      consecutiveFailures++;
      if (consecutiveFailures >= 1) emitHealth("degraded");

      const wrapped = new Error(
        isTimeout
          ? "O servidor demorou demasiado tempo a responder."
          : offline
            ? "Sem ligação à internet."
            : "Não foi possível contactar o servidor.",
      );
      (wrapped as Error & { cause?: unknown }).cause = error;
      throw wrapped;
    } finally {
      clearTimeout(timer);
      if (external) external.removeEventListener("abort", onExternalAbort);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Não foi possível contactar o servidor.");
}

export default resilientFetch;
