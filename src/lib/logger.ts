/**
 * Production-safe logger.
 *
 * - In development (import.meta.env.DEV): forwards to the real console for full visibility.
 * - In production: `debug` and `info` are silenced; `warn` and `error` are kept
 *   (they're valuable for Sentry / user support) but sensitive payloads should
 *   still be scrubbed by the caller. `error` also forwards to Sentry when available.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.debug("cart", cart);        // dev only
 *   logger.error("checkout failed", e); // always
 *
 * This wrapper is additive — existing `console.*` calls keep working. Migrate
 * hot paths first (auth, billing, invoices, quotes) to reduce PII leakage.
 */

// Vite exposes import.meta.env.DEV as true in `vite dev` and false in `vite build`.
const isDev = typeof import.meta !== "undefined" && !!(import.meta as any).env?.DEV;

type Args = unknown[];

function forwardError(args: Args) {
  try {
    // Optional Sentry breadcrumb — only if @sentry/browser is loaded via src/lib/sentry.
    const w = globalThis as any;
    if (w?.Sentry?.captureException && args[0] instanceof Error) {
      w.Sentry.captureException(args[0], { extra: { rest: args.slice(1) } });
    }
  } catch {
    /* noop */
  }
}

export const logger = {
  debug: (...args: Args) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: Args) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: Args) => {
    // Warnings are useful in production too, but keep them terse.
    console.warn(...args);
  },
  error: (...args: Args) => {
    console.error(...args);
    forwardError(args);
  },
};

export default logger;
