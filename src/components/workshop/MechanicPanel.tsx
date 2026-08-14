import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, StickyNote, Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";

/**
 * Painel do mecânico dentro da OS. NÃO cria sistemas novos:
 *  - Fotos  → bucket "inspection-files" + tabela work_order_attachments (já existentes)
 *  - Notas  → campo work_orders.notes (já existente), em modo append
 *  - Peças  → catálogo public.parts + linhas da OS (work_orders.lines, type='part'),
 *             o consumo de stock continua a ser feito na conclusão do serviço.
 */

const PHOTO_CONTEXTS = ["Antes", "Durante", "Depois", "Problema", "Peça", "Conclusão"] as const;

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  context: string | null;
  created_at: string;
}

interface PartRow {
  id: string;
  name: string;
  sale_price: number;
  internal_cost: number;
  vat_rate: number;
}

interface WorkOrderLine {
  id: string;
  type: "service" | "part";
  name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  vat_rate: number;
  ref_id?: string | null;
}

interface Props {
  workOrderId: string;
  shopId: string;
  technicianName?: string;
  /** Chamado após alterações que mexem em totais/notas, para o ecrã recarregar. */
  onChanged?: () => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function MechanicPanel({ workOrderId, shopId, technicianName = "", onChanged }: Props) {
  const [tab, setTab] = useState<"photo" | "note" | "part">("photo");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [noteDraft, setNoteDraft] = useState("");
  const [parts, setParts] = useState<PartRow[]>([]);
  const [partLines, setPartLines] = useState<WorkOrderLine[]>([]);
  const [selectedPart, setSelectedPart] = useState("");
  const [qty, setQty] = useState("1");
  const [photoContext, setPhotoContext] = useState<string>("Durante");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [attRes, woRes, partsRes] = await Promise.all([
      supabase
        .from("work_order_attachments")
        .select("id, file_name, file_url, context, created_at")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("work_orders").select("notes, lines").eq("id", workOrderId).eq("shop_id", shopId).maybeSingle(),
      supabase
        .from("parts")
        .select("id, name, sale_price, internal_cost, vat_rate")
        .eq("shop_id", shopId)
        .eq("active", true)
        .order("name")
        .limit(500),
    ]);
    setAttachments((attRes.data as Attachment[]) || []);
    setNotes(((woRes.data as any)?.notes as string) || "");
    const lines = Array.isArray((woRes.data as any)?.lines) ? ((woRes.data as any).lines as WorkOrderLine[]) : [];
    setPartLines(lines.filter((l) => l?.type === "part"));
    setParts((partsRes.data as PartRow[]) || []);
  }, [workOrderId, shopId]);

  useEffect(() => { void load(); }, [load]);

  /** Fotos — reutiliza o bucket privado já usado pelo checklist. */
  const uploadPhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Ficheiro inválido: escolha uma imagem.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${shopId}/${workOrderId}/photos/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("inspection-files")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from("inspection-files")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signErr) throw signErr;
      const { error: insErr } = await supabase.from("work_order_attachments").insert({
        shop_id: shopId,
        work_order_id: workOrderId,
        file_name: file.name,
        file_url: signed?.signedUrl || path,
        file_type: file.type,
        file_size: file.size,
        context: photoContext,
      } as any);
      if (insErr) throw insErr;
      toast.success("Foto adicionada.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar a foto.");
    } finally {
      setBusy(false);
    }
  };

  /** Notas — append ao campo existente work_orders.notes. */
  const addNote = async () => {
    const text = noteDraft.trim();
    if (!text) return;
    setBusy(true);
    try {
      const stamp = new Date().toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
      const who = technicianName ? ` · ${technicianName}` : "";
      const line = `[${stamp}${who}] ${text}`;
      const next = notes ? `${notes}\n${line}` : line;
      const { error } = await supabase.from("work_orders").update({ notes: next }).eq("id", workOrderId).eq("shop_id", shopId);
      if (error) throw error;
      setNotes(next);
      setNoteDraft("");
      toast.success("Nota registada.");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gravar a nota.");
    } finally {
      setBusy(false);
    }
  };

  /** Peças — adiciona linha à OS e recalcula totais (mesma fórmula do ServiceForm). */
  const addPart = async () => {
    const part = parts.find((p) => p.id === selectedPart);
    const quantity = Math.max(1, Math.floor(Number(qty) || 0));
    if (!part) { toast.error("Escolha uma peça."); return; }
    setBusy(true);
    try {
      const [{ data: wo, error: woErr }, { data: shop }] = await Promise.all([
        supabase.from("work_orders").select("lines, labor_hours").eq("id", workOrderId).eq("shop_id", shopId).maybeSingle(),
        supabase.from("shops").select("labor_rate, vat_rate").eq("id", shopId).maybeSingle(),
      ]);
      if (woErr) throw woErr;
      const currentLines: WorkOrderLine[] = Array.isArray((wo as any)?.lines) ? ((wo as any).lines as WorkOrderLine[]) : [];
      const laborRate = Number((shop as any)?.labor_rate) || 0;
      const shopVat = Number((shop as any)?.vat_rate) || 0;

      const newLine: WorkOrderLine = {
        id: crypto.randomUUID(),
        type: "part",
        name: part.name,
        quantity,
        unit_price: Number(part.sale_price) || 0,
        unit_cost: Number(part.internal_cost) || 0,
        vat_rate: Number(part.vat_rate ?? shopVat),
        ref_id: part.id,
      };
      const lines = [...currentLines, newLine];

      const laborCharge = round2((Number((wo as any)?.labor_hours) || 0) * laborRate);
      const linesSubtotal = round2(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0));
      const subtotal = round2(linesSubtotal + laborCharge);
      const vatTotal = round2(
        lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (Number(l.vat_rate) || 0) / 100, 0) +
        (laborCharge * shopVat) / 100,
      );
      const total = round2(subtotal + vatTotal);
      const costTotal = round2(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0));
      const profit = round2(subtotal - costTotal);

      const { error } = await supabase
        .from("work_orders")
        .update({ lines: lines as any, subtotal, vat_total: vatTotal, total, cost_total: costTotal, profit })
        .eq("id", workOrderId);
      if (error) throw error;

      setPartLines(lines.filter((l) => l.type === "part"));
      setSelectedPart("");
      setQty("1");
      toast.success("Peça registada na OS. O stock é descontado ao concluir o serviço.");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível registar a peça.");
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { key: "photo" as const, label: "Foto", icon: Camera },
    { key: "note" as const, label: "Nota", icon: StickyNote },
    { key: "part" as const, label: "Peça", icon: Wrench },
  ];

  return (
    <div className="border border-border rounded-xl p-3 space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={`min-h-[44px] rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
              tab === tb.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            <tb.icon className="w-4 h-4" />
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "photo" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Select value={photoContext} onValueChange={setPhotoContext}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PHOTO_CONTEXTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className={`min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 cursor-pointer ${busy ? "opacity-60 pointer-events-none" : ""}`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              Adicionar
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadPhoto(f);
                }}
              />
            </label>
          </div>
          {attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem fotos nesta intervenção.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {attachments.map((a) => (
                <a key={a.id} href={a.file_url} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={a.file_url} alt={a.context || a.file_name} className="w-full aspect-square object-cover rounded-lg border border-border" loading="lazy" />
                  {a.context && <span className="block text-[10px] text-muted-foreground text-center mt-0.5">{a.context}</span>}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "note" && (
        <div className="space-y-2">
          <Textarea
            rows={2}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Ex.: Pastilha traseira direita apresenta desgaste."
          />
          <Button size="sm" className="w-full min-h-[44px]" onClick={addNote} disabled={busy || !noteDraft.trim()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <StickyNote className="w-4 h-4 mr-1" />}
            Guardar nota
          </Button>
          {notes ? (
            <pre className="text-xs bg-muted rounded-lg p-2 whitespace-pre-wrap font-sans max-h-32 overflow-y-auto">{notes}</pre>
          ) : (
            <p className="text-xs text-muted-foreground">Sem notas registadas.</p>
          )}
        </div>
      )}

      {tab === "part" && (
        <div className="space-y-2">
          {parts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sem peças no catálogo. Adicione peças em <a href="/stock" className="text-primary hover:underline">Inventário</a>.
            </p>
          ) : (
            <div className="flex gap-2">
              <Select value={selectedPart} onValueChange={setSelectedPart}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Escolher peça" /></SelectTrigger>
                <SelectContent>
                  {parts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {formatMoney(Number(p.sale_price) || 0)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="w-16" />
              <Button size="sm" className="min-h-[44px]" onClick={addPart} disabled={busy || !selectedPart}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registar"}
              </Button>
            </div>
          )}
          {partLines.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem peças registadas nesta OS.</p>
          ) : (
            <ul className="space-y-1">
              {partLines.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-2 py-1.5">
                  <span className="truncate">{l.name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">×{l.quantity}</Badge>
                    <span className="tabular-nums">{formatMoney((Number(l.quantity) || 0) * (Number(l.unit_price) || 0))}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
