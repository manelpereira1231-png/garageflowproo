/**
 * Sentry — error tracking & performance monitoring.
 *
 * Inert until `VITE_SENTRY_DSN` is provided as a workspace BUILD secret
 * (Workspace Settings → Build Secrets). When unset, all helpers are no-ops
 * so dev/preview keeps zero overhead and zero noise.
 */
import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = (import.meta.env.MODE || "production") as string;

let initialized = false;

export function initSentry() {
  if (initialized) return;
  if (!DSN) return; // dormant — no DSN configured
  try {
    Sentry.init({
      dsn: DSN,
      environment: ENV,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
      // Filter out known noisy chunk-load errors handled by our boundary.
      beforeSend(event, hint) {
        const msg = (hint?.originalException as Error | undefined)?.message ?? "";
        if (
          msg.includes("Loading chunk") ||
          msg.includes("dynamically imported module") ||
          msg.includes("Importing a module script failed")
        ) {
          return null;
        }
        return event;
      },
    });
    initialized = true;
  } catch {
    // Never let Sentry init crash the app
  }
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* noop */
  }
}

export function setSentryUser(user: { id: string; email?: string | null } | null) {
  if (!initialized) return;
  try {
    if (user) Sentry.setUser({ id: user.id, email: user.email ?? undefined });
    else Sentry.setUser(null);
  } catch {
    /* noop */
  }
}

export const isSentryEnabled = () => initialized;
