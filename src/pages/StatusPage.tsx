import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Activity } from "lucide-react";

type Check = { name: string; status: "ok" | "warn" | "down"; detail?: string };

export default function StatusPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const run = async () => {
    setLoading(true);
    const next: Check[] = [];

    // 1. DB reachability via a cheap public read (feature flags has SELECT for all)
    const t0 = Date.now();
    const { error: dbErr } = await supabase.from("system_feature_flags" as any).select("key").limit(1);
    const dbMs = Date.now() - t0;
    next.push({
      name: "Base de dados",
      status: dbErr ? "down" : dbMs > 1500 ? "warn" : "ok",
      detail: dbErr ? dbErr.message : `${dbMs} ms`,
    });

    // 2. Auth endpoint
    const t1 = Date.now();
    const { error: authErr } = await supabase.auth.getSession();
    next.push({
      name: "Autenticação",
      status: authErr ? "down" : "ok",
      detail: authErr ? authErr.message : `${Date.now() - t1} ms`,
    });

    // 3. Edge functions (calls a lightweight one if available, otherwise skip)
    try {
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-country`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      next.push({
        name: "Edge Functions",
        status: r.ok ? "ok" : r.status >= 500 ? "down" : "warn",
        detail: `HTTP ${r.status}`,
      });
    } catch (e: any) {
      next.push({ name: "Edge Functions", status: "down", detail: e.message });
    }

    // 4. Public storage (manifest fetch)
    try {
      const r = await fetch("/manifest.json", { cache: "no-store" });
      next.push({ name: "CDN / Assets", status: r.ok ? "ok" : "warn", detail: `HTTP ${r.status}` });
    } catch {
      next.push({ name: "CDN / Assets", status: "down" });
    }

    setChecks(next);
    setUpdatedAt(new Date());
    setLoading(false);
  };

  useEffect(() => {
    run();
    const id = setInterval(run, 60_000);
    return () => clearInterval(id);
  }, []);

  const overall: Check["status"] = checks.some(c => c.status === "down")
    ? "down" : checks.some(c => c.status === "warn") ? "warn" : "ok";

  const icon = (s: Check["status"]) =>
    s === "ok" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> :
    s === "warn" ? <AlertTriangle className="h-5 w-5 text-amber-500" /> :
    <XCircle className="h-5 w-5 text-red-500" />;

  const overallLabel = overall === "ok" ? "Todos os sistemas operacionais"
    : overall === "warn" ? "Degradação parcial" : "Incidente em curso";

  return (
    <>
      <Helmet>
        <title>Estado do Sistema · GarageFlow</title>
        <meta name="description" content="Estado em tempo real dos serviços do GarageFlow: base de dados, autenticação, edge functions e CDN." />
        <link rel="canonical" href="https://garageflow-pt.lovable.app/status" />
      </Helmet>

      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6" /> Estado do Sistema
            </h1>
            <Badge variant={overall === "ok" ? "outline" : overall === "warn" ? "secondary" : "destructive"}>
              {overallLabel}
            </Badge>
          </header>

          <Card className="p-6 space-y-3">
            {checks.map((c) => (
              <div key={c.name} className="flex items-center justify-between border-b last:border-0 py-2">
                <div className="flex items-center gap-3">
                  {icon(c.status)}
                  <span className="font-medium">{c.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{c.detail}</span>
              </div>
            ))}
            {checks.length === 0 && loading && (
              <p className="text-sm text-muted-foreground">A verificar serviços…</p>
            )}
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            Atualizado {updatedAt ? updatedAt.toLocaleTimeString("pt-PT") : "—"} · Auto-refresh 60s
          </p>

          <Card className="p-4 text-xs text-muted-foreground">
            <p><strong>SLOs alvo:</strong> Disponibilidade API 99.5% mensal · p95 latência API &lt; 800 ms · 5xx &lt; 1%.</p>
            <p className="mt-1">Incidentes críticos são publicados aqui em até 15 minutos da deteção.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
