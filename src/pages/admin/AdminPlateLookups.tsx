import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";

type Row = { id: string; shop_id: string; plate_norm: string; source: string; status: string; error_code: string | null; duration_ms: number | null; created_at: string; user_id: string | null };
type Limit = { shop_id: string; monthly_limit: number | null; blocked: boolean };

export default function AdminPlateLookups() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Row[]>([]);
  const [shops, setShops] = useState<Record<string, string>>({});
  const [limits, setLimits] = useState<Record<string, Limit>>({});
  const [provider, setProvider] = useState<{ state: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [{ data: r }, { data: l }, prov] = await Promise.all([
      supabase.from("vehicle_lookups").select("id, shop_id, plate_norm, source, status, error_code, duration_ms, created_at, user_id").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
      supabase.from("vehicle_lookup_limits").select("shop_id, monthly_limit, blocked"),
      supabase.functions.invoke("vehicle-lookup", { body: { action: "provider_status" } }),
    ]);
    const list = (r || []) as Row[];
    setRows(list);
    setLimits(Object.fromEntries(((l || []) as Limit[]).map((x) => [x.shop_id, x])));
    setProvider((prov.data as any) || { state: "error" });
    const ids = Array.from(new Set([...list.map((x) => x.shop_id), ...((l || []) as Limit[]).map((x) => x.shop_id)]));
    if (ids.length) {
      const { data: s } = await supabase.from("shops").select("id, name").in("id", ids);
      setShops(Object.fromEntries((s || []).map((x: any) => [x.id, x.name || "—"])));
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [days]);

  const byShop = useMemo(() => {
    const m: Record<string, { total: number; api: number; cache: number; ok: number; err: number; last: string }> = {};
    rows.forEach((r) => {
      const s = (m[r.shop_id] ||= { total: 0, api: 0, cache: 0, ok: 0, err: 0, last: r.created_at });
      s.total++;
      if (r.source === "api") s.api++;
      if (r.source === "cache") s.cache++;
      if (r.status === "ok") s.ok++; else s.err++;
      if (r.created_at > s.last) s.last = r.created_at;
    });
    Object.keys(limits).forEach((id) => { m[id] ||= { total: 0, api: 0, cache: 0, ok: 0, err: 0, last: "" }; });
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  }, [rows, limits]);

  const saveLimit = async (shopId: string, patch: Partial<Limit>) => {
    const cur = limits[shopId] || { shop_id: shopId, monthly_limit: null, blocked: false };
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("vehicle_lookup_limits").upsert({ ...cur, ...patch, shop_id: shopId, updated_by: u.user?.id, updated_at: new Date().toISOString() });
    if (error) toast.error("Não foi possível guardar."); else { toast.success("Guardado."); void load(); }
  };

  const stateLabel: Record<string, [string, "default" | "secondary" | "destructive"]> = {
    configured: ["Configurado", "default"], not_configured: ["Não configurado", "secondary"], error: ["Erro", "destructive"],
  };
  const st = provider ? stateLabel[provider.state] || stateLabel.error : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ScanSearch className="w-6 h-6" />Consultas de Matrículas</h1>
          <p className="text-sm text-muted-foreground">Matricula.co.pt {st && <Badge variant={st[1]} className="ml-2">{st[0]}</Badge>}</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>{d} dias</Button>)}
        </div>
      </div>

      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : byShop.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem consultas no período.</p>
      ) : (
        <div className="grid gap-3">
          {byShop.map(([shopId, s]) => {
            const lim = limits[shopId];
            return (
              <div key={shopId} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{shops[shopId] || shopId.slice(0, 8)}</p>
                  <div className="flex gap-2 items-center">
                    {lim?.blocked && <Badge variant="destructive">Bloqueado</Badge>}
                    <Badge variant="outline">{lim?.monthly_limit != null ? `Limite ${lim.monthly_limit}/mês` : "Ilimitado"}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-sm">
                  <div><span className="block text-[10px] uppercase text-muted-foreground">Consultas</span>{s.total}</div>
                  <div><span className="block text-[10px] uppercase text-muted-foreground">Reais (API)</span>{s.api}</div>
                  <div><span className="block text-[10px] uppercase text-muted-foreground">Cache</span>{s.cache}</div>
                  <div><span className="block text-[10px] uppercase text-muted-foreground">Sucessos</span>{s.ok}</div>
                  <div><span className="block text-[10px] uppercase text-muted-foreground">Erros</span>{s.err}</div>
                  <div><span className="block text-[10px] uppercase text-muted-foreground">Última</span>{s.last ? new Date(s.last).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "—"}</div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Input className="w-32" type="number" min={0} placeholder="Limite/mês" value={editLimit[shopId] ?? (lim?.monthly_limit?.toString() || "")} onChange={(e) => setEditLimit((p) => ({ ...p, [shopId]: e.target.value }))} />
                  <Button size="sm" variant="outline" onClick={() => { const v = editLimit[shopId]; saveLimit(shopId, { monthly_limit: v === "" || v == null ? null : Math.max(0, parseInt(v, 10) || 0) }); }}>Guardar limite</Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditLimit((p) => ({ ...p, [shopId]: "" })); saveLimit(shopId, { monthly_limit: null }); }}>Ilimitado</Button>
                  <Button size="sm" variant={lim?.blocked ? "default" : "destructive"} onClick={() => saveLimit(shopId, { blocked: !lim?.blocked })}>{lim?.blocked ? "Desbloquear" : "Bloquear"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDetail(shopId)}>Ver detalhes</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail ? shops[detail] : ""}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {rows.filter((r) => r.shop_id === detail).slice(0, 200).map((r) => (
              <div key={r.id} className="flex flex-wrap justify-between gap-2 text-sm border-b pb-2">
                <span className="mono">{r.plate_norm}</span>
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-PT")}</span>
                <Badge variant={r.status === "ok" ? "default" : "secondary"}>{r.status}</Badge>
                <Badge variant="outline">{r.source}</Badge>
                {r.duration_ms != null && <span className="text-xs text-muted-foreground">{r.duration_ms} ms</span>}
                {r.error_code && <span className="w-full text-xs text-muted-foreground truncate">{r.error_code}</span>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
