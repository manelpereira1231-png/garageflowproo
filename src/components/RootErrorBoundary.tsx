import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureError } from "@/lib/sentry";

interface State {
  hasError: boolean;
  error: Error | null;
}

const RECOVERY_KEY = "garageflow_root_recovery_at";
const RECOVERY_WINDOW_MS = 60_000; // avoid reload loops

const t = (key: "title" | "desc" | "reload" | "home" | "details") => {
  let lang = "pt";
  try {
    lang = (typeof localStorage !== "undefined" && localStorage.getItem("garageflow_language")) || "pt";
  } catch {
    lang = "pt";
  }
  const dict: Record<string, Record<string, string>> = {
    pt: {
      title: "Algo correu mal",
      desc: "Aconteceu um erro inesperado. Os teus dados estão seguros — basta recarregar.",
      reload: "Recarregar",
      home: "Voltar ao início",
      details: "Detalhes técnicos",
    },
    en: {
      title: "Something went wrong",
      desc: "An unexpected error happened. Your data is safe — just reload.",
      reload: "Reload",
      home: "Back home",
      details: "Technical details",
    },
    es: {
      title: "Algo salió mal",
      desc: "Ocurrió un error inesperado. Tus datos están a salvo — solo recarga.",
      reload: "Recargar",
      home: "Volver al inicio",
      details: "Detalles técnicos",
    },
  };
  return dict[lang]?.[key] ?? dict.pt[key];
};

/**
 * Global error boundary mounted at the root. Catches any uncaught render
 * error from children (above & beyond the route-level ChunkErrorBoundary
 * which handles lazy-load failures).
 *
 * Renders a polished branded fallback instead of the white React screen.
 */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Best-effort logging; never throws.
    try {
      console.error("[RootErrorBoundary]", error, info?.componentStack);
      captureError(error, { componentStack: info?.componentStack });
    } catch {
      /* noop */
    }
  }

  private reload = () => {
    try {
      const now = Date.now();
      const last = Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
      if (now - last < RECOVERY_WINDOW_MS) {
        // Already reloaded recently — don't loop, just clear state.
        this.setState({ hasError: false, error: null });
        return;
      }
      sessionStorage.setItem(RECOVERY_KEY, String(now));
    } catch {
      /* noop */
    }
    window.location.reload();
  };

  private goHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-lg">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-foreground mb-2">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mb-6">{t("desc")}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={this.reload}
              className="h-11 px-6 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
            >
              {t("reload")}
            </button>
            <button
              onClick={this.goHome}
              className="h-11 px-6 rounded-md border border-border text-foreground font-medium hover:bg-muted/50 transition"
            >
              {t("home")}
            </button>
          </div>
          {this.state.error?.message && (
            <details className="mt-6 text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                {t("details")}
              </summary>
              <pre className="mt-2 text-[10px] text-muted-foreground bg-muted/40 p-2 rounded overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

export default RootErrorBoundary;
