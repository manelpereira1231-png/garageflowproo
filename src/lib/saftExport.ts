import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Exportação SAF-T em segundo plano.
 *
 * O ficheiro pode demorar dezenas de segundos a ser gerado no servidor.
 * Em vez de bloquear a página (spinner infinito), corre em background com
 * um toast persistente: o utilizador pode continuar a trabalhar e o
 * download arranca sozinho quando o XML estiver pronto.
 */
export function exportSaftInBackground(opts: {
  shopId: string;
  year: number | string;
  filename?: string;
  timeoutMs?: number;
}): void {
  const { shopId, year, timeoutMs = 5 * 60 * 1000 } = opts;
  const filename = opts.filename || `SAFT-PT_${year}.xml`;
  const toastId = `saft-${shopId}-${year}`;

  toast.loading("A gerar SAF-T… pode continuar a trabalhar.", {
    id: toastId,
    description: "O download começa automaticamente quando estiver pronto.",
  });

  void (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Volte a iniciar sessão.", { id: toastId });
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-saft`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ shop_id: shopId, year: Number(year) }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = text;
        try { message = JSON.parse(text)?.error ?? text; } catch { /* texto simples */ }
        toast.error(message || `Falha ao gerar SAF-T (HTTP ${res.status})`, { id: toastId });
        return;
      }

      const raw = await res.text();
      let xml = raw;
      if (raw.trim().startsWith("{")) {
        try { xml = JSON.parse(raw)?.xml ?? raw; } catch { /* mantém raw */ }
      }
      if (!xml.trim()) {
        toast.error("O servidor devolveu um SAF-T vazio.", { id: toastId });
        return;
      }

      const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("SAF-T exportado (informativo, software não certificado).", { id: toastId });
    } catch (e: any) {
      const aborted = e?.name === "AbortError";
      toast.error(
        aborted
          ? "A geração do SAF-T demorou demasiado. Tente um período mais curto."
          : e?.message || "Erro ao exportar SAF-T",
        { id: toastId },
      );
    } finally {
      clearTimeout(timer);
    }
  })();
}
