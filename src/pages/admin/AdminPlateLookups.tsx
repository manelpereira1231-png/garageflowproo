import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, ScanSearch, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { invalidateVehicleLookupEnabled } from "@/hooks/useVehicleLookupEnabled";

type Row = { id: string; shop_id: string; plate_norm: string; source: string; status: string; error_code: string | null; duration_ms: number | null; created_at: string; user_id: string | null };
type Limit = { shop_id: string; monthly_limit: number | null; blocked: boolean };
type Cfg = {
  enabled: boolean; global_monthly_limit: number | null; cost_per_call: number | null;
  alert_count: number | null; alert_cost: number | null; auto_block_enabled: boolean; auto_block_cost: number | null;
};
const DEFAULT_CFG: Cfg = { enabled: true, global_monthly_limit: null, cost_per_call: null, alert_count: null, alert_cost: null, auto_block_enabled: false, auto_block_cost: null };

type Period = "today" | "7" | "30" | "month" | "prev" | "custom";
const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

function range(p: Period, from: string, to: string): [string, string] {
  const now = new Date();
  if (p === "today") { const s = new Date(); s.setHours(0, 0, 0, 0); return [s.toISOString(), now.toISOString()]; }
  if (p === "7" || p === "30") return [new Date(Date.now() - Number(p) * 86400000).toISOString(), now.toISOString()];
  if (p === "month") return [monthStart().toISOString(), now.toISOString()];
  if (p === "prev") { const s = monthStart(); const ps = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - 1, 1)); return [ps.toISOString(), s.toISOString()]; }
  return [from ? new Date(from).toISOString() : monthStart().toISOString(), to ? new Date(to + "T23:59:59").toISOString() : now.toISOString()];
}

const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v.replace(",", "."))));
const isErr = (r: Row) => r.source === "api" && r.status !== "ok" && r.status !== "not_found";

export default function AdminPlateLookups() {
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [monthRows, setMonthRows] = useState<Row[]>([]);
  const [shops, setShops] = useState<Record<string, string>>({});
  const [limits, setLimits] = useState<Record<string, Limit>>({});
  const [provider, setProvider] = useState<{ state: string } | null>(null);
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [autoBlock, setAutoBlock] = useState(false);
  const [confirmTo, setConfirmTo] = useState<boolean | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState<Record<string, string>>({});

  const loadCfg = async () => {
    const { data } = await supabase.from("platform_settings").select("value").eq("key", "vehicle_lookup").maybeSingle();
    const c = { ...DEFAULT_CFG, ...((data?.value as any) || {}) } as Cfg;
    setCfg(c);
    setAutoBlock(!!c.auto_block_enabled);
    setDraft({
      global_monthly_limit: c.global_monthly_limit?.toString() ?? "", cost_per_call: c.cost_per_call?.toString() ?? "",
      alert_count: c.alert_count?.toString() ?? "", alert_cost: c.alert_cost?.toString() ?? "", auto_block_cost: c.auto_block_cost?.toString() ?? "",
    });
  };

  const load = async () => {
    setLoading(true);
    const [s, e] = range(period, from, to);
    const sel = "id, shop_id, plate_norm, source, status, error_code, duration_ms, created_at, user_id";
    const [{ data: r }, { data: m }, { data: l }, prov, { data: au }] = await Promise.all([
      supabase.from("vehicle_lookups").select(sel).gte("created_at", s).lt("created_at", e).order("created_at", { ascending: false }).limit(5000),
      supabase.from("vehicle_lookups").select(sel).gte("created_at", monthStart().toISOString()).limit(10000),
      supabase.from("vehicle_lookup_limits").select("shop_id, monthly_limit, blocked"),
      supabase.functions.invoke("vehicle-lookup", { body: { action: "provider_status" } }),
      supabase.from("audit_logs").select("id, action, details, created_at, user_id, entity_id")
        .in("action", ["vehicle_lookup_settings", "vehicle_lookup_shop_limit", "vehicle_lookup_alert", "vehicle_lookup_auto_block"])
        .order("created_at", { ascending: false }).limit(50),
    ]);
    const list = (r || []) as Row[];
    setRows(list);
    setMonthRows((m || []) as Row[]);
    setLimits(Object.fromEntries(((l || []) as Limit[]).map((x) => [x.shop_id, x])));
    setProvider((prov.data as any) || { state: "error" });
    setAudit(au || []);
    const ids = Array.from(new Set([...list.map((x) => x.shop_id), ...((l || []) as Limit[]).map((x) => x.shop_id), ...((m || []) as Row[]).map((x) => x.shop_id)]));
    if (ids.length) {
      const { data: sh } = await supabase.from("shops").select("id, name").in("id", ids);
      setShops(Object.fromEntries((sh || []).map((x: any) => [x.id, x.name || "—"])));
    }
    setLoading(false);
  };
  useEffect(() => { void loadCfg(); }, []);
  useEffect(() => { if (period !== "custom" || (from && to)) void load(); }, [period, from, to]);

  const saveCfg = async (patch: Partial<Cfg>) => {
    const next = { ...cfg, ...patch };
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("platform_settings").upsert(
      { key: "vehicle_lookup", value: next as any, updated_by: u.user?.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) { toast.error("Não foi possível guardar."); return false; }
    setCfg(next); invalidateVehicleLookupEnabled(); toast.success("Guardado."); void load();
    return true;
  };

  const saveSettings = () => saveCfg({
    global_monthly_limit: num(draft.global_monthly_limit || ""), cost_per_call: num(draft.cost_per_call || ""),
    alert_count: num(draft.alert_count || ""), alert_cost: num(draft.alert_cost || ""),
    auto_block_enabled: autoBlock, auto_block_cost: num(draft.auto_block_cost || ""),
  });

  const unit = Number(cfg.cost_per_call) || 0;
  const month = useMemo(() => {
    const api = monthRows.filter((r) => r.source === "api").length;
    return {
      requested: monthRows.length, api, cache: monthRows.filter((r) => r.source === "cache").length,
      err: monthRows.filter(isErr).length, blocked: monthRows.filter((r) => r.source === "blocked").length,
      cost: api * unit,
    };
  }, [monthRows, unit]);
  const remaining = cfg.global_monthly_limit != null ? Math.max(0, cfg.global_monthly_limit - month.api) : null;
  const globalReached = cfg.global_monthly_limit != null && month.api >= cfg.global_monthly_limit;
  const costReached = cfg.auto_block_enabled && cfg.auto_block_cost != null && unit > 0 && (month.api + 1) * unit > cfg.auto_block_cost + 1e-9;
  const alertReached = (cfg.alert_count != null && month.api >= cfg.alert_count) || (cfg.alert_cost != null && unit > 0 && month.cost >= cfg.alert_cost);
  const suspended = cfg.enabled && (globalReached || costReached);

  const periodStats = useMemo(() => {
    const api = rows.filter((r) => r.source === "api").length;
    return { api, cache: rows.filter((r) => r.source === "cache").length, err: rows.filter(isErr).length, cost: api * unit };
  }, [rows, unit]);

  const byShop = useMemo(() => {
    const m: Record<string, { api: number; cache: number; err: number; total: number; last: string }> = {};
    rows.forEach((r) => {
      const s = (m[r.shop_id] ||= { api: 0, cache: 0, err: 0, total: 0, last: r.created_at });
      s.total++;
      if (r.source === "api") s.api++;
      if (r.source === "cache") s.cache++;
      if (isErr(r)) s.err++;
      if (r.created_at > s.last) s.last = r.created_at;
    });
    Object.keys(limits).forEach((id) => { m[id] ||= { api: 0, cache: 0, err: 0, total: 0, last: "" }; });
    return Object.entries(m).sort((a, b) => b[1].api - a[1].api || b[1].total - a[1].total);
  }, [rows, limits]);
  const monthApiByShop = useMemo(() => {
    const m: Record<string, number> = {};
    monthRows.forEach((r) => { if (r.source === "api") m[r.shop_id] = (m[r.shop_id] || 0) + 1; });
    return m;
  }, [monthRows]);

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

  const auditText = (a: any) => {
    const d = a.details || {};
    if (a.action === "vehicle_lookup_alert") return `Alerta de consumo: ${d.calls} chamadas · ${formatMoney(d.cost || 0)} este mês`;
    if (a.action === "vehicle_lookup_auto_block") return `Bloqueio automático por custo (teto ${formatMoney(d.cap || 0)})`;
    if (a.action === "vehicle_lookup_shop_limit") {
      const b = d.before || {}; const n = d.after || {};
      return `Oficina ${shops[a.entity_id] || ""}: limite ${b.monthly_limit ?? "ilimitado"} → ${n.monthly_limit ?? "ilimitado"}, ${b.blocked ? "bloqueada" : "ativa"} → ${n.blocked ? "bloqueada" : "ativa"}`;
    }
    const b = d.before || {}; const n = d.after || {};
    const changes = Object.keys({ ...b, ...n }).filter((k) => JSON.stringify(b[k]) !== JSON.stringify(n[k]));
    const L: Record<string, string> = { enabled: "Serviço", global_monthly_limit: "Limite global", cost_per_call: "Custo/consulta", alert_count: "Alerta (nº)", alert_cost: "Alerta (€)", auto_block_enabled: "Proteção automática", auto_block_cost: "Teto de custo" };
    const f = (v: any) => (v === true ? "ON" : v === false ? "OFF" : v ?? "—");
    return changes.map((k) => `${L[k] || k}: ${f(b[k])} → ${f(n[k])}`).join(" · ") || "Configuração guardada";
  };

  const Stat = ({ label, value, tone }: { label: string; value: any; tone?: string }) => (
    <div className="rounded-lg border bg-card p-3"><p className={`text-xl font-bold ${tone || ""}`}>{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ScanSearch className="w-6 h-6" />Consultas de Matrículas</h1>
        <p className="text-sm text-muted-foreground">Matricula.co.pt {st && <Badge variant={st[1]} className="ml-2">{st[0]}</Badge>}</p>
      </div>

      {/* Interruptor global */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="font-semibold">Serviço de consulta por matrícula</p>
            <p className="text-sm flex flex-wrap gap-2 items-center">
              {cfg.enabled ? <Badge className="bg-success text-success-foreground">● Ativo</Badge> : <Badge variant="destructive">● Desativado</Badge>}
              {cfg.enabled && costReached && <Badge variant="destructive">Proteção de custos: limite atingido</Badge>}
              {cfg.enabled && globalReached && <Badge variant="destructive">Limite global mensal atingido</Badge>}
              {suspended && <span className="text-xs text-muted-foreground">Chamadas externas: suspensas</span>}
            </p>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium">
            Permitir consultas externas por matrícula
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setConfirmTo(v)} />
          </label>
        </div>
        {alertReached && (
          <p className="text-sm flex items-center gap-2 text-warning"><AlertTriangle className="w-4 h-4" />
            Alerta de consumo: {month.api} chamadas externas{unit > 0 ? ` · ${formatMoney(month.cost)}` : ""} este mês.</p>
        )}
      </div>

      {/* Este mês */}
      <div>
        <p className="text-sm font-medium mb-2">Este mês</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <Stat label="Consultas solicitadas" value={month.requested} />
          <Stat label="Chamadas externas" value={month.api} />
          <Stat label="Cache" value={month.cache} />
          <Stat label="Erros" value={month.err} />
          <Stat label="Custo estimado" value={unit > 0 ? formatMoney(month.cost) : "—"} />
          <Stat label="Limite global" value={cfg.global_monthly_limit ?? "Sem limite"} />
          <Stat label="Restantes" value={remaining ?? "—"} tone={globalReached ? "text-destructive" : ""} />
        </div>
        {month.blocked > 0 && <p className="text-xs text-muted-foreground mt-1">{month.blocked} pedidos recusados antes do fornecedor (serviço desligado, bloqueio ou limites).</p>}
      </div>

      {/* Configuração de custos */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="font-semibold">Limites e custos</p>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div><Label>Limite global mensal de chamadas externas</Label><Input inputMode="numeric" placeholder="Sem limite" value={draft.global_monthly_limit || ""} onChange={(e) => setDraft({ ...draft, global_monthly_limit: e.target.value })} /></div>
          <div><Label>Custo estimado por consulta (€)</Label><Input inputMode="decimal" placeholder="Ex.: 0,20" value={draft.cost_per_call || ""} onChange={(e) => setDraft({ ...draft, cost_per_call: e.target.value })} /></div>
          <div className="hidden lg:block" />
          <div><Label>Alertar ao atingir (nº de consultas)</Label><Input inputMode="numeric" value={draft.alert_count || ""} onChange={(e) => setDraft({ ...draft, alert_count: e.target.value })} /></div>
          <div><Label>Alertar ao atingir (custo €)</Label><Input inputMode="decimal" value={draft.alert_cost || ""} onChange={(e) => setDraft({ ...draft, alert_cost: e.target.value })} /></div>
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={autoBlock} onCheckedChange={(v) => setAutoBlock(!!v)} />Bloquear automaticamente ao atingir (€)</label>
            <Input inputMode="decimal" disabled={!autoBlock} value={draft.auto_block_cost || ""} onChange={(e) => setDraft({ ...draft, auto_block_cost: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Contam só as chamadas reais ao fornecedor. Respostas da cache não têm custo. Os contadores recomeçam em cada mês sem apagar o histórico. O fornecedor não disponibiliza oficialmente o saldo disponível, por isso não é mostrado.</p>
        <Button onClick={saveSettings}>Guardar limites e custos</Button>
      </div>

      {/* Histórico */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {([["today", "Hoje"], ["7", "7 dias"], ["30", "30 dias"], ["month", "Este mês"], ["prev", "Mês anterior"], ["custom", "Personalizado"]] as [Period, string][]).map(([k, l]) => (
            <Button key={k} size="sm" variant={period === k ? "default" : "outline"} onClick={() => setPeriod(k)}>{l}</Button>
          ))}
          {period === "custom" && (<>
            <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </>)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Chamadas reais" value={periodStats.api} />
          <Stat label="Cache" value={periodStats.cache} />
          <Stat label="Erros" value={periodStats.err} />
          <Stat label="Custo estimado" value={unit > 0 ? formatMoney(periodStats.cost) : "—"} />
        </div>

        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : byShop.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem consultas no período.</p>
        ) : (
          <div className="grid gap-3">
            {byShop.map(([shopId, s]) => {
              const lim = limits[shopId];
              const usedMonth = monthApiByShop[shopId] || 0;
              const rest = lim?.monthly_limit != null ? Math.max(0, lim.monthly_limit - usedMonth) : null;
              return (
                <div key={shopId} className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{shops[shopId] || shopId.slice(0, 8)}</p>
                    <div className="flex gap-2 items-center">
                      {lim?.blocked ? <Badge variant="destructive">Bloqueada</Badge> : <Badge variant="secondary">Ativa</Badge>}
                      <Badge variant="outline">{lim?.monthly_limit != null ? `Limite ${lim.monthly_limit}/mês` : "Ilimitada"}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-sm">
                    <div><span className="block text-[10px] uppercase text-muted-foreground">API real</span>{s.api}</div>
                    <div><span className="block text-[10px] uppercase text-muted-foreground">Cache</span>{s.cache}</div>
                    <div><span className="block text-[10px] uppercase text-muted-foreground">Erros</span>{s.err}</div>
                    <div><span className="block text-[10px] uppercase text-muted-foreground">Restantes (mês)</span>{rest ?? "—"}</div>
                    <div><span className="block text-[10px] uppercase text-muted-foreground">Custo estimado</span>{unit > 0 ? formatMoney(s.api * unit) : "—"}</div>
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
      </div>

      {/* Auditoria */}
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="font-semibold">Auditoria</p>
        {audit.length === 0 ? <p className="text-sm text-muted-foreground">Sem alterações registadas.</p> : audit.map((a) => (
          <div key={a.id} className="text-sm border-b last:border-0 pb-2">
            <p>{auditText(a)}</p>
            <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-PT")}{a.user_id ? "" : " · automático"}</p>
          </div>
        ))}
      </div>

      <AlertDialog open={confirmTo !== null} onOpenChange={(o) => !o && setConfirmTo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTo ? "Ativar consultas por matrícula?" : "Desativar consultas por matrícula?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTo
                ? "As oficinas autorizadas voltarão a poder utilizar a consulta automática por matrícula, respeitando os respetivos limites."
                : "Todas as oficinas deixarão imediatamente de poder realizar novas consultas externas por matrícula. Os dados já existentes serão mantidos e as oficinas continuarão a poder criar e editar viaturas manualmente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { const v = confirmTo!; setConfirmTo(null); await saveCfg({ enabled: v }); }}>
              {confirmTo ? "Ativar consultas" : "Desativar consultas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
