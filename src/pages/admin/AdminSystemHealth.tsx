import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, Database, Mail, Zap, Server, Clock, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, HardDrive, CreditCard,
  FileText, Users, Shield, TrendingUp
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/i18n/LanguageContext";

interface HealthCheck {
  name: string;
  status: "healthy" | "warning" | "error";
  latency?: number;
  details?: string;
  icon: any;
}

interface StorageStats {
  buckets: { name: string; isPublic: boolean; fileCount: number }[];
}

export default function AdminSystemHealth() {
  const { t } = useLanguage();
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [emailStats, setEmailStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [shopCount, setShopCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [latencyHistory, setLatencyHistory] = useState<{ time: string; db: number; auth: number }[]>([]);
  const [tableStats, setTableStats] = useState<{ table: string; count: number }[]>([]);
  const [recentErrors, setRecentErrors] = useState<{ time: string; action: string; details: string }[]>([]);
  const [trialStats, setTrialStats] = useState({ total: 0, today: 0 });
  const [subStats, setSubStats] = useState({ active: 0, trialing: 0, cancelled: 0 });

  const runHealthCheck = async () => {
    setLoading(true);
    const results: HealthCheck[] = [];

    // DB check
    const dbStart = Date.now();
    const { error: dbErr, count: shopsTotal } = await supabase.from("shops").select("id", { count: "exact", head: true });
    const dbLatency = Date.now() - dbStart;
    results.push({
      name: "Base de Dados",
      status: dbErr ? "error" : dbLatency > 2000 ? "warning" : "healthy",
      latency: dbLatency,
      details: dbErr ? dbErr.message : `${dbLatency}ms`,
      icon: Database,
    });

    // Auth check
    const authStart = Date.now();
    const { error: authErr } = await supabase.auth.getSession();
    const authLatency = Date.now() - authStart;
    results.push({
      name: "Autenticação",
      status: authErr ? "error" : authLatency > 3000 ? "warning" : "healthy",
      latency: authLatency,
      details: authErr ? authErr.message : `${authLatency}ms`,
      icon: Server,
    });

    // Email check
    const { data: emails, count: emailCount } = await supabase.from("email_logs").select("status", { count: "exact" }).gte("created_at", new Date(Date.now() - 86400000).toISOString());
    const sent = emails?.filter(e => e.status === "sent").length || 0;
    const failed = emails?.filter(e => e.status === "failed").length || 0;
    setEmailStats({ total: emailCount || 0, sent, failed });
    results.push({
      name: "Serviço de Email",
      status: failed > sent * 0.5 ? "error" : failed > 0 ? "warning" : "healthy",
      details: `${sent} enviados, ${failed} falhados (24h)`,
      icon: Mail,
    });

    // Automations
    const { count: automationCount } = await supabase.from("automation_rules").select("id", { count: "exact", head: true }).eq("active", true);
    results.push({
      name: "Automações",
      status: "healthy",
      details: `${automationCount || 0} regras ativas`,
      icon: Zap,
    });

    // Stripe check (via edge function)
    const stripeStart = Date.now();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("check-subscription", {
        body: { action: "health_check" },
      });
      const stripeLatency = Date.now() - stripeStart;
      results.push({
        name: "Pagamentos (Stripe)",
        status: res.error ? "warning" : stripeLatency > 5000 ? "warning" : "healthy",
        latency: stripeLatency,
        details: res.error ? "Função indisponível" : `${stripeLatency}ms`,
        icon: CreditCard,
      });
    } catch {
      results.push({
        name: "Pagamentos (Stripe)",
        status: "warning",
        latency: Date.now() - stripeStart,
        details: "Não verificado",
        icon: CreditCard,
      });
    }

    // Storage check
    const storageStart = Date.now();
    try {
      const { data: logoFiles } = await supabase.storage.from("shop-logos").list("", { limit: 1 });
      const storageLatency = Date.now() - storageStart;
      results.push({
        name: "Armazenamento",
        status: storageLatency > 3000 ? "warning" : "healthy",
        latency: storageLatency,
        details: `${storageLatency}ms`,
        icon: HardDrive,
      });
    } catch {
      results.push({
        name: "Armazenamento",
        status: "error",
        details: "Erro ao verificar",
        icon: HardDrive,
      });
    }

    // Fetch counts
    const [usersRes, subsRes, trialsRes] = await Promise.all([
      supabase.from("shop_users").select("id", { count: "exact", head: true }),
      supabase.from("subscriptions").select("status"),
      supabase.from("trial_records").select("id, created_at", { count: "exact" }),
    ]);
    setShopCount(shopsTotal || 0);
    setUserCount(usersRes.count || 0);

    const subs = subsRes.data || [];
    setSubStats({
      active: subs.filter(s => s.status === "active").length,
      trialing: subs.filter(s => s.status === "trialing").length,
      cancelled: subs.filter(s => s.status === "cancelled" || s.status === "canceled").length,
    });

    const trials = trialsRes.data || [];
    const todayStr = new Date().toISOString().split("T")[0];
    setTrialStats({
      total: trialsRes.count || 0,
      today: trials.filter(t => t.created_at?.startsWith(todayStr)).length,
    });

    // Table row counts
    const tableCounts: { table: string; count: number }[] = [];
    const tables = [
      { name: "shops", label: "Oficinas" },
      { name: "clients", label: "Clientes" },
      { name: "vehicles", label: "Veículos" },
      { name: "quotes", label: "Orçamentos" },
      { name: "invoices", label: "Faturas" },
      { name: "subscriptions", label: "Subscrições" },
      { name: "audit_logs", label: "Registos de Auditoria" },
      { name: "email_logs", label: "Registos de Email" },
    ];
    for (const tbl of tables) {
      const { count } = await supabase.from(tbl.name as any).select("id", { count: "exact", head: true });
      tableCounts.push({ table: tbl.label, count: count || 0 });
    }
    setTableStats(tableCounts);

    // Recent errors from audit logs
    const { data: errorLogs } = await supabase
      .from("audit_logs")
      .select("created_at, action, details")
      .in("action", ["error", "failed", "shop_deleted", "shop_suspended", "subscription_cancelled"])
      .order("created_at", { ascending: false })
      .limit(10);
    setRecentErrors((errorLogs || []).map(l => ({
      time: new Date(l.created_at).toLocaleString("pt-PT"),
      action: l.action,
      details: typeof l.details === "object" ? JSON.stringify(l.details) : String(l.details || ""),
    })));

    // Update latency history
    setLatencyHistory(prev => {
      const next = [...prev, {
        time: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
        db: dbLatency,
        auth: authLatency,
      }].slice(-10);
      return next;
    });

    setChecks(results);
    setLastCheck(new Date());
    setLoading(false);
  };

  useEffect(() => { runHealthCheck(); }, []);

  const statusIcon = (status: string) => {
    if (status === "healthy") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "warning") return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const overallStatus = checks.some(c => c.status === "error") ? "error" : checks.some(c => c.status === "warning") ? "warning" : "healthy";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-20 bg-muted/30 animate-pulse rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Card key={i}><CardContent className="pt-5 h-20 animate-pulse bg-muted/30" /></Card>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2"><Activity className="w-6 h-6 text-primary" /> {t('admin.health.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('admin.health.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={runHealthCheck} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> {t('admin.health.refresh')}
        </Button>
      </div>

      {/* Overall status */}
      <Card className={overallStatus === "healthy" ? "border-green-500/30 bg-green-500/5" : overallStatus === "warning" ? "border-yellow-500/30 bg-yellow-500/5" : "border-red-500/30 bg-red-500/5"}>
        <CardContent className="pt-5">
          <div className="flex items-center gap-3">
            {statusIcon(overallStatus)}
            <div>
              <p className="font-semibold">{overallStatus === "healthy" ? t('admin.health.allOperational') : overallStatus === "warning" ? t('admin.health.warnings') : t('admin.health.issues')}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {t('admin.health.lastCheck')}: {lastCheck.toLocaleTimeString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">{t('admin.health.shops')}</p><p className="text-xl font-bold">{shopCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">{t('admin.health.users')}</p><p className="text-xl font-bold">{userCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Ativas</p><p className="text-xl font-bold text-green-500">{subStats.active}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Trial</p><p className="text-xl font-bold text-primary">{subStats.trialing}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Canceladas</p><p className="text-xl font-bold text-destructive">{subStats.cancelled}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">{t('admin.health.emails24h')}</p><p className="text-xl font-bold">{emailStats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">{t('admin.health.emailsFailed')}</p><p className="text-xl font-bold text-destructive">{emailStats.failed}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">Trials (hoje)</p><p className="text-xl font-bold">{trialStats.today}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="latency">Latência</TabsTrigger>
          <TabsTrigger value="database">Base de Dados</TabsTrigger>
          <TabsTrigger value="events">Eventos Recentes</TabsTrigger>
        </TabsList>

        {/* Services tab */}
        <TabsContent value="services">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {checks.map((check, i) => (
              <Card key={i} className={check.status === "healthy" ? "" : check.status === "warning" ? "border-yellow-500/20" : "border-red-500/20"}>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        check.status === "healthy" ? "bg-green-500/10" : check.status === "warning" ? "bg-yellow-500/10" : "bg-red-500/10"
                      }`}>
                        <check.icon className={`w-5 h-5 ${
                          check.status === "healthy" ? "text-green-500" : check.status === "warning" ? "text-yellow-500" : "text-red-500"
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{check.name}</p>
                        <p className="text-xs text-muted-foreground">{check.details}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {statusIcon(check.status)}
                      {check.latency && <span className="text-[10px] text-muted-foreground mono">{check.latency}ms</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Latency tab */}
        <TabsContent value="latency">
          <div className="stat-card">
            <h2 className="text-sm font-semibold mb-3">Histórico de Latência (últimas verificações)</h2>
            {latencyHistory.length > 1 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={latencyHistory}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis className="text-xs" unit="ms" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                    <Bar dataKey="db" name="Base de Dados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="auth" name="Autenticação" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Clique em "Atualizar" várias vezes para gerar histórico de latência</p>
            )}
          </div>
        </TabsContent>

        {/* Database tab */}
        <TabsContent value="database">
          <div className="stat-card">
            <h2 className="text-sm font-semibold mb-3">Contagem de Registos por Tabela</h2>
            {tableStats.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tableStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="table" type="category" width={100} className="text-xs" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </div>
        </TabsContent>

        {/* Events tab */}
        <TabsContent value="events">
          <div className="stat-card">
            <h2 className="text-sm font-semibold mb-3">Últimos Eventos Críticos</h2>
            {recentErrors.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum evento crítico recente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{err.action}</Badge>
                        <span className="text-[10px] text-muted-foreground mono">{err.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{err.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
