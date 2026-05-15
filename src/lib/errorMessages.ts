/**
 * Standardized error → user-friendly message translator.
 * Maps common Supabase / Postgres / network errors to PT-PT (with EN/ES fallback).
 *
 * Usage:
 *   import { toastError } from "@/lib/errorMessages";
 *   try { ... } catch (e) { toastError(e, "Não foi possível guardar o cliente"); }
 */
import { toast } from "sonner";

type Lang = "pt" | "en" | "es";

const getLang = (): Lang => {
  if (typeof localStorage === "undefined") return "pt";
  const v = localStorage.getItem("garageflow_language");
  if (v === "en" || v === "es") return v;
  return "pt";
};

interface MessageMap {
  pt: string;
  en: string;
  es: string;
}

// Match common Supabase / Postgres error signatures to friendly messages.
// Order matters — first match wins.
const PATTERNS: Array<{ test: (msg: string, code?: string) => boolean; msg: MessageMap }> = [
  {
    test: (m) => /failed to fetch|network ?error|networkerror|load failed/i.test(m),
    msg: {
      pt: "Sem ligação à internet. Verifica a tua rede e tenta novamente.",
      en: "No internet connection. Check your network and try again.",
      es: "Sin conexión a internet. Verifica tu red e inténtalo de nuevo.",
    },
  },
  {
    test: (_m, code) => code === "23505",
    msg: {
      pt: "Esse registo já existe.",
      en: "That record already exists.",
      es: "Ese registro ya existe.",
    },
  },
  {
    test: (_m, code) => code === "23503",
    msg: {
      pt: "Não é possível eliminar — existem dados associados.",
      en: "Cannot delete — there is associated data.",
      es: "No se puede eliminar — hay datos asociados.",
    },
  },
  {
    test: (_m, code) => code === "23502",
    msg: {
      pt: "Faltam campos obrigatórios.",
      en: "Required fields are missing.",
      es: "Faltan campos obligatorios.",
    },
  },
  {
    test: (m) => /row.level security|rls|permission denied|not authorized|forbidden/i.test(m),
    msg: {
      pt: "Não tens permissão para esta ação.",
      en: "You don't have permission for this action.",
      es: "No tienes permiso para esta acción.",
    },
  },
  {
    test: (m) => /jwt|invalid token|expired|not authenticated/i.test(m),
    msg: {
      pt: "A tua sessão expirou. Inicia sessão novamente.",
      en: "Your session has expired. Please sign in again.",
      es: "Tu sesión ha expirado. Vuelve a iniciar sesión.",
    },
  },
  {
    test: (m) => /rate limit|too many requests|429/i.test(m),
    msg: {
      pt: "Demasiados pedidos. Aguarda um momento.",
      en: "Too many requests. Please wait a moment.",
      es: "Demasiadas solicitudes. Espera un momento.",
    },
  },
  {
    test: (m) => /timeout|timed out/i.test(m),
    msg: {
      pt: "O servidor demorou demasiado. Tenta novamente.",
      en: "The server took too long. Please try again.",
      es: "El servidor tardó demasiado. Inténtalo de nuevo.",
    },
  },
];

function translate(err: unknown): string {
  const lang = getLang();
  const fallback: MessageMap = {
    pt: "Ocorreu um erro inesperado. Tenta novamente.",
    en: "An unexpected error occurred. Please try again.",
    es: "Ocurrió un error inesperado. Inténtalo de nuevo.",
  };

  if (!err) return fallback[lang];

  // Extract message + code
  let message = "";
  let code: string | undefined;
  if (typeof err === "string") {
    message = err;
  } else if (err instanceof Error) {
    message = err.message || "";
    code = (err as Error & { code?: string }).code;
  } else if (typeof err === "object") {
    const e = err as { message?: string; code?: string; error_description?: string; details?: string };
    message = e.message || e.error_description || e.details || "";
    code = e.code;
  }

  for (const p of PATTERNS) {
    if (p.test(message, code)) return p.msg[lang];
  }

  // If message is short & looks human, surface it; otherwise generic fallback.
  if (message && message.length < 120 && !/^[A-Z_]+$/.test(message) && !/[<>{}]/.test(message)) {
    return message;
  }
  return fallback[lang];
}

/**
 * Show a standardized error toast. `context` is an optional human-readable
 * prefix (e.g. "Não foi possível guardar o cliente") shown as the toast title.
 */
export function toastError(err: unknown, context?: string) {
  const description = translate(err);
  if (context) {
    toast.error(context, { description });
  } else {
    toast.error(description);
  }
  // Always log full error for devs.
  try {
    console.error("[toastError]", context ?? "", err);
  } catch {
    /* noop */
  }
}

export function getErrorMessage(err: unknown): string {
  return translate(err);
}
