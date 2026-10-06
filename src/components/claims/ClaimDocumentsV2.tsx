import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Camera, FileText, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { DOC_CATEGORY_LABELS } from "@/lib/claims";

/** Categorias propostas no carregamento (as antigas continuam a ser mostradas). */
export const UPLOAD_CATEGORIES = ["friendly_declaration", "expertise", "authorization", "damage", "hidden_damage", "invoice", "other"] as const;
export const docLabel = (c: string, isBR: boolean) => {
  const m: Record<string, string> = { ...DOC_CATEGORY_LABELS, friendly_declaration: "Declaração Amigável", expertise: "Relatório de peritagem", damage: "Danos", hidden_damage: "Danos ocultos", invoice: isBR ? "Nota fiscal" : "Fatura" };
  return m[c] || c;
};
const BUCKET = "work-order-files";
export const storagePath = (url: string) => (url.includes(`/${BUCKET}/`) ? decodeURIComponent(url.split(`/${BUCKET}/`)[1].split("?")[0]) : null);
const isImage = (d: any) => (d.file_type || "").startsWith("image/") || /\.(jpe?g|png|webp|heic|gif)$/i.test(d.file_name || "");

/** Carrega ficheiros para o sinistro (reutiliza claim_documents + armazenamento existente). */
export async function uploadClaimFiles(files: File[], opts: { shopId: string; claimId: string; category: string }) {
  const { data: auth } = await supabase.auth.getSession();
  let ok = 0;
  for (const file of files) {
    const path = `${opts.shopId}/claims/${opts.claimId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file);
    if (up.error) { toast.error(up.error.message); continue; }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { error } = await supabase.from("claim_documents").insert({
      shop_id: opts.shopId, claim_id: opts.claimId, category: opts.category,
      file_name: file.name, file_url: pub.publicUrl, file_type: file.type, file_size: file.size,
      uploaded_by: auth.session?.user.id ?? null,
    });
    if (error) toast.error(error.message); else ok++;
  }
  return ok;
}

export function ClaimDocumentsV2({ claimId, shopId, docs, isBR, onChanged }: { claimId: string; shopId: string; docs: any[]; isBR: boolean; onChanged: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [viewer, setViewer] = useState<string | null>(null);
  const loc = isBR ? "pt-BR" : "pt-PT";

  useEffect(() => {
    const paths = docs.map((d) => storagePath(d.file_url)).filter(Boolean) as string[];
    if (!paths.length) { setUrls({}); return; }
    supabase.storage.from(BUCKET).createSignedUrls(paths, 3600).then(({ data }) => {
      const m: Record<string, string> = {};
      (data || []).forEach((r) => { if (r.path && r.signedUrl) m[r.path] = r.signedUrl; });
      setUrls(m);
    });
  }, [docs]);
  const urlOf = (d: any) => { const p = storagePath(d.file_url); return (p && urls[p]) || d.file_url; };

  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const d of docs) (g[d.category] ||= []).push(d);
    return Object.entries(g);
  }, [docs]);

  const pick = (list: FileList | null) => {
    const files = Array.from(list || []).filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    if (!files.length) { toast.error("Só são aceites fotografias e PDF."); return; }
    setPending(files);
  };
  const confirm = async (category: string) => {
    if (!pending) return;
    setBusy(true);
    const n = await uploadClaimFiles(pending, { shopId, claimId, category });
    setBusy(false); setPending(null);
    if (n) { toast.success(n === 1 ? "Documento guardado" : `${n} documentos guardados`); onChanged(); }
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("claim_documents").delete().eq("id", id);
    if (error) toast.error(error.message); else onChanged();
  };

  const viewing = viewer ? (groups.find(([c]) => c === viewer)?.[1] || []) : [];

  return (
    <Card className="rounded-[14px]">
      <CardHeader><CardTitle className="text-base">Documentos</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
          className={`w-full rounded-[14px] border-2 border-dashed px-4 py-8 text-center transition-colors min-h-[44px] ${drag ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"}`}
        >
          <Camera className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="font-semibold">Tirar fotografia ou arrastar ficheiros</p>
          <p className="text-sm text-muted-foreground">{isBR ? "No celular abre logo a câmera. Uma foto por folha." : "No telemóvel abre logo a câmara. Uma foto por folha."}</p>
        </button>
        <input ref={inputRef} type="file" accept="image/*,application/pdf" capture="environment" multiple className="hidden"
          onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />

        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não há documentos. Fotografe a Declaração Amigável, o relatório do perito e os danos.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {groups.map(([cat, list]) => {
              const img = list.find(isImage);
              const last = list.reduce((a, b) => (a.created_at > b.created_at ? a : b));
              return (
                <button key={cat} type="button" onClick={() => setViewer(cat)} className="overflow-hidden rounded-[14px] border border-border text-left hover:border-primary/60">
                  <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                    {img ? <img src={urlOf(img)} alt={docLabel(cat, isBR)} className="h-full w-full object-cover" loading="lazy" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-medium truncate">{docLabel(cat, isBR)}</p>
                    <p className="text-xs text-muted-foreground">{list.length} {list.length === 1 ? "ficheiro" : "ficheiros"} · {new Date(last.created_at).toLocaleDateString(loc, { day: "2-digit", month: "2-digit" })}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Que documento é este?</DialogTitle>
            <DialogDescription>{pending?.length === 1 ? "1 ficheiro" : `${pending?.length} ficheiros`} selecionado(s).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {UPLOAD_CATEGORIES.map((c) => (
              <Button key={c} variant="outline" className="min-h-[44px] justify-start" disabled={busy} onClick={() => confirm(c)}>{docLabel(c, isBR)}</Button>
            ))}
          </div>
          {busy && <p className="text-sm text-muted-foreground">A carregar…</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-5xl w-[96vw] max-h-[94vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewer ? docLabel(viewer, isBR) : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {viewing.map((d) => (
              <div key={d.id} className="space-y-2">
                {isImage(d) ? <img src={urlOf(d)} alt={d.file_name} className="w-full rounded-lg object-contain max-h-[75vh] bg-muted" /> : (
                  <div className="flex items-center gap-2 rounded-lg border border-border p-3"><FileText className="h-5 w-5" /><span className="truncate">{d.file_name}</span></div>
                )}
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{new Date(d.created_at).toLocaleString(loc)}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="min-h-[44px]" asChild><a href={urlOf(d)} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-1" />Abrir</a></Button>
                    <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4 mr-1" />Apagar</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
