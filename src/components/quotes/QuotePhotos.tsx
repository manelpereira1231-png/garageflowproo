import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, ImagePlus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const MAX = 7;

interface Props {
  quoteId: string;
  shopId: string;
  photos: string[];
  onChange: (paths: string[]) => void;
}

/** Fotografias privadas do orçamento (bucket quote-photos, até 7). */
export function QuotePhotos({ quoteId, shopId, photos, onChange }: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const missing = photos.filter((p) => !urls[p]);
    if (!missing.length) return;
    supabase.storage.from("quote-photos").createSignedUrls(missing, 3600).then(({ data }) => {
      const next: Record<string, string> = {};
      (data || []).forEach((d) => { if (d.path && d.signedUrl) next[d.path] = d.signedUrl; });
      setUrls((u) => ({ ...u, ...next }));
    });
  }, [photos]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = async (next: string[]) => {
    const { error } = await supabase.from("quotes").update({ photos: next as any }).eq("id", quoteId).eq("shop_id", shopId);
    if (error) { toast.error(error.message.includes("7") ? "Máximo de 7 fotografias por orçamento." : error.message); return false; }
    onChange(next);
    return true;
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const free = MAX - photos.length;
    if (free <= 0) { toast.error("Limite de 7 fotografias atingido."); return; }
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length > free) toast.error(`Só pode adicionar mais ${free}. As restantes foram ignoradas.`);
    setBusy(true);
    const added: string[] = [];
    for (const f of list.slice(0, free)) {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: máximo 10 MB.`); continue; }
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${shopId}/${quoteId}/${crypto.randomUUID()}.${ext || "jpg"}`;
      const { error } = await supabase.storage.from("quote-photos").upload(path, f, { contentType: f.type });
      if (error) toast.error(error.message); else added.push(path);
    }
    if (added.length) {
      const ok = await persist([...photos, ...added]);
      if (!ok) await supabase.storage.from("quote-photos").remove(added);
      else toast.success(`${added.length} fotografia(s) adicionada(s).`);
    }
    setBusy(false);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const remove = async (path: string) => {
    setBusy(true);
    if (await persist(photos.filter((p) => p !== path))) {
      await supabase.storage.from("quote-photos").remove([path]);
    }
    setBusy(false);
  };

  const full = photos.length >= MAX;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium">Fotografias <span className="text-muted-foreground">({photos.length}/{MAX})</span></span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="min-h-[44px]" disabled={busy || full} onClick={() => cameraRef.current?.click()}>
            <Camera className="w-4 h-4 mr-1" /> Câmara
          </Button>
          <Button type="button" variant="outline" size="sm" className="min-h-[44px]" disabled={busy || full} onClick={() => galleryRef.current?.click()}>
            <ImagePlus className="w-4 h-4 mr-1" /> Galeria
          </Button>
        </div>
        <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files)} />
      </div>
      {full && <p className="text-xs text-muted-foreground">Limite máximo de 7 fotografias atingido.</p>}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {photos.map((p) => (
            <div key={p} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
              {urls[p] && <button type="button" className="w-full h-full" onClick={() => setOpen(p)}><img src={urls[p]} alt="Fotografia do orçamento" className="w-full h-full object-cover" /></button>}
              <button type="button" aria-label="Remover fotografia" disabled={busy} onClick={() => remove(p)}
                className="absolute top-1 right-1 rounded-full bg-background/90 p-1.5 text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {open && urls[open] && (
        <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <button type="button" aria-label="Fechar" className="absolute top-4 right-4 p-2"><X className="w-6 h-6" /></button>
          <img src={urls[open]} alt="Fotografia" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}
