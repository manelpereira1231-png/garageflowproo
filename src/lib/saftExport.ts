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
  const { shopId, year, timeoutMs = 10 * 60 * 1000 } = opts;
  const filename = opts.filename || `SAFT-PT_${year}.xml`;
  const toastId = `saft-${shopId}-${year}`;

  toast.loading("A gerar SAF-T… pode continuar a trabalhar.", {
    id: toastId,
    description: "O download começa automaticamente quando estiver pronto.",
  });

  void (async () => {
    const startedAt = Date.now();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Volte a iniciar sessão.", { id: toastId });
        return;
      }

      const { data: queued, error: queueError } = await supabase.functions.invoke("export-saft", {
        body: { shop_id: shopId, year: Number(year), action: "enqueue" },
      });
      if (queueError || !queued?.job_id) throw queueError || new Error("Não foi possível iniciar a exportação.");

      let job: { status: string; progress: number; storage_path?: string; filename?: string; error_message?: string } | null = null;
      while (Date.now() - startedAt < timeoutMs) {
        const { data, error } = await (supabase as any)
          .from("saft_export_jobs")
          .select("status, progress, storage_path, filename, error_message")
          .eq("id", queued.job_id)
          .maybeSingle();
        if (error) throw error;
        job = data;
        if (job?.status === "completed" || job?.status === "failed") break;
        toast.loading(`A gerar SAF-T… ${job?.progress ?? 0}%`, {
          id: toastId,
          description: "Pode continuar a trabalhar normalmente.",
        });
        await new Promise(resolve => window.setTimeout(resolve, 1500));
      }

      if (!job || job.status !== "completed" || !job.storage_path) {
        throw new Error(job?.error_message || "A geração do SAF-T demorou demasiado. Tente novamente.");
      }

      const { data: file, error: downloadError } = await supabase.storage
        .from("saft-exports")
        .download(job.storage_path);
      if (downloadError || !file) throw downloadError || new Error("Não foi possível descarregar o SAF-T.");

      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = job.filename || filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("SAF-T exportado (informativo, software não certificado).", { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao exportar SAF-T", { id: toastId });
    }
  })();
}
