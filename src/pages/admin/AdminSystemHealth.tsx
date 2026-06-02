import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, Database, Mail, Zap, Server, Clock, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, HardDrive, CreditCard,
  Shield
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface HealthCheck {
  name: string;
  status: "healthy" | "warning" | "error";
  latency?: number;
  details?: string;
  icon: any;
}

export default function AdminSystemHealth() {
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

    // 1. Base de Dados
    const dbStart = Date.now();
    const { error: dbErr, count: shopsTotal } = await supabase.from("shops").select("id", { count: "exact", head: true });
    const dbLatency = Date.now() - dbStart;
    results.push({
      name: "Base de Dados",
      status: dbErr ? "error" : dbLatency > 2000 ? "warning" : "healthy",
      latency: dbLatency,
      details: dbErr ? `Erro: ${dbErr.message}` : dbLatency < 500 ? `Rápida (${dbLatency}ms)` : `Normal (${dbLatency}ms)`,
      icon: Database,
    });

    // 2. Autenticação
    const authStart = Date.now();
    const { error: authErr } = await supabase.auth.getSession();
    const authLatency = Date.now() - authStart;
    results.push({
      name: "Autenticação",
      status: authErr ? "error" : authLatency > 3000 ? "warning" : "healthy",
      latency: authLatency,
      details: authErr ? `Erro: ${authErr.message}` : authLatency < 500 ? `Rápida (${authLatency}ms)` : `Normal (${authLatency}ms)`,
      icon: Server,
    });

    // 3. Email (últimas 24h)
    const { data: emails, count: emailCount } = await supabase
      .from("email_logs")
      .select("status", { count: "exact" })
      .gte("created_at", new Date(Date.now() - 86400000).toISOString());
    const sent = emails?.filter(e => e.status === "sent").length || 0;
    const failed = emails?.filter(e => e.status === "failed").length || 0;
    setEmailStats({ total: emailCount || 0, sent, failed });
    results.push({
      name: "Serviço de Email",
      status: failed > sent * 0.5 ? "error" : failed > 0 ? "warning" : "healthy",
      details: emailCount === 0 ? "Nenhum email nas últimas 24h" : `${sent} enviados, ${failed} falhados (24h)`,
      icon: Mail,
    });

    // 4. Automações
    const { count: automationCount } = await supabase.from("automation_rules").select("id", { count: "exact", head: true }).eq("active", true);
    results.push({
      name: "Automações",
      status: "healthy",
      details: `${automationCount || 0} regras ativas`,
      icon: Zap,
    });

    // 5. Stripe / Pagamentos
    const stripeStart = Date.now();
    try {
      const res = await supabase.functions.invoke("check-subscription", {
        body: { action: "health_check" },
      });
      const stripeLatency = Date.now() - stripeStart;
      results.push({
        name: "Pagamentos (Stripe)",
        status: res.error ? "warning" : stripeLatency > 5000 ? "warning" : "healthy",
        latency: stripeLatency,
        details: res.error ? "Serviço com atraso ou indisponível" : stripeLatency < 1000 ? `Rápido (${stripeLatency}ms)` : `Normal (${stripeLatency}ms)`,
        icon: CreditCard,
      });
    } catch {
      results.push({
        name: "Pagamentos (Stripe)",
        status: "warning",
        latency: Date.now() - stripeStart,
        details: "Não foi possível verificar",
        icon: CreditCard,
      });
    }

    // 6. Armazenamento
    const storageStart = Date.now();
    try {
      await supabase.storage.from("shop-logos").list("", { limit: 1 });
      const storageLatency = Date.now() - storageStart;
      results.push({
        name: "Armazenamento de Ficheiros",
        status: storageLatency > 3000 ? "warning" : "healthy",
        latency: storageLatency,
        details: storageLatency < 500 ? `Rápido (${storageLatency}ms)` : `Normal (${storageLatency}ms)`,
        icon: HardDrive,
      });
    } catch {
      results.push({
        name: "Armazenamento de Ficheiros",
        status: "error",
        details: "Erro ao verificar armazenamento",
        icon: HardDrive,
      });
    }

    // Estatísticas gerais
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

    // Contagem de registos por tabela
    const tableDefs = [
      { name: "shops", label: "Oficinas" },
      { name: "clients", label: "Clientes" },
      { name: "vehicles", label: "Veículos" },
      { name: "quotes", label: "Orçamentos" },
      { name: "invoices", label: "Faturas" },
      { name: "work_orders", label: "Ordens de Serviço" },
      { name: "subscriptions", label: "Subscrições" },
      { name: "audit_logs", label: "Logs de Auditoria" },
      { name: "email_logs", label: "Logs de Email" },
    ];
    const countResults = await Promise.all(
      tableDefs.map(tbl =>
        supabase.from(tbl.name as any).select("id", { count: "exact", head: true })
      )
    );
    const tableCounts = tableDefs.map((tbl, i) => ({ table: tbl.label, count: countResults[i].count || 0 }));
    setTableStats(tableCounts);

    // Eventos críticos recentes
    const { data: errorLogs } = await supabase
      .from("audit_logs")
      .select("created_at, action, details")
      .in("action", ["error", "failed", "shop_deleted", "shop_suspended", "subscription_cancelled"])
      .order("created_at", { ascending: false })
      .limit(10);

    const actionLabels: Record<string, string> = {
      error: "Erro",
      failed: "Falha",
      shop_deleted: "Oficina eliminada",
      shop_suspended: "Oficina suspensa",
      subscription_cancelled: "Subscrição cancelada",
    };

    setRecentErrors((errorLogs || []).map(l => ({
      time: new Date(l.created_at).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      action: actionLabels[l.action] || l.action,
      details: typeof l.details === "object" ? JSON.stringify(l.details) : String(l.details || ""),
    })));

    // Histórico de latência
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
    if (status === "healthy") return <CheckCircle className="w-5 h-5 text-success" />;
    if (status === "warning") return <AlertTriangle className="w-5 h-5 text-warning" />;
    return <XCircle className="w-5 h-5 text-destructive" />;
  };

  const statusLabel = (status: string) => {
    if (status === "healthy") return "Operacional";
    if (status === "warning") return "Aviso";
    return "Erro";
  };

  const overallStatus = checks.some(c => c.status === "error") ? "error" : checks.some(c => c.status === "warning") ? "warning" : "healthy";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary animate-pulse" />
          <div>
            <h1 className="text-xl font-bold">A verificar o sistema...</h1>
            <p className="text-sm text-muted-foreground">A testar todos os serviços. Aguarde alguns segundos.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="pt-5 h-20 animate-pulse bg-muted/30" /></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}><CardContent className="pt-5 h-24 animate-pulse bg-muted/30" /></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Saúde do Sistema
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitorização em tempo real de todos os serviços da plataforma
          </p>
        </div>
        <Button variant="outline" onClick={runHealthCheck} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Verificar Agora
        </Button>
      </div>

      {/* Estado geral */}
      <Card className={
        overallStatus === "healthy"
          ? "border-success/30 bg-success/5"
          : overallStatus === "warning"
            ? "border-warning/30 bg-warning/5"
            : "border-destructive/30 bg-destructive/5"
      }>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3">
            {statusIcon(overallStatus)}
            <div>
              <p className="font-semibold text-base">
                {overallStatus === "healthy"
                  ? "✅ Todos os sistemas operacionais"
                  : overallStatus === "warning"
                    ? "⚠️ Alguns serviços com avisos"
                    : "🔴 Problemas detetados — verificar abaixo"
                }
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                Última verificação: {lastCheck.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo rápido */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
          Resumo da Plataforma
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Oficinas</p>
              <p className="text-xl font-bold">{shopCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Utilizadores</p>
              <p className="text-xl font-bold">{userCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Subscrições Ativas</p>
              <p className="text-xl font-bold text-success">{subStats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Em Trial</p>
              <p className="text-xl font-bold text-primary">{subStats.trialing}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Canceladas</p>
              <p className="text-xl font-bold text-destructive">{subStats.cancelled}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Emails (24h)</p>
              <p className="text-xl font-bold">{emailStats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Emails Falhados</p>
              <p className="text-xl font-bold text-destructive">{emailStats.failed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Trials Hoje</p>
              <p className="text-xl font-bold">{trialStats.today}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Estado dos Serviços</TabsTrigger>
          <TabsTrigger value="latency">Velocidade</TabsTrigger>
          <TabsTrigger value="database">Base de Dados</TabsTrigger>
          <TabsTrigger value="events">Eventos Críticos</TabsTrigger>
        </TabsList>

        {/* Serviços */}
        <TabsContent value="services">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {checks.map((check, i) => (
              <Card
                key={i}
                className={
                  check.status === "healthy"
                    ? "border-success/20"
                    : check.status === "warning"
                      ? "border-warning/30 bg-warning/5"
                      : "border-destructive/30 bg-destructive/5"
                }
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        check.status === "healthy" ? "bg-success/10" : check.status === "warning" ? "bg-warning/10" : "bg-destructive/10"
                      }`}>
                        <check.icon className={`w-5 h-5 ${
                          check.status === "healthy" ? "text-success" : check.status === "warning" ? "text-warning" : "text-destructive"
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{check.name}</p>
                        <p className="text-xs text-muted-foreground">{check.details}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          check.status === "healthy"
                            ? "bg-success/10 text-success border-success/30"
                            : check.status === "warning"
                              ? "bg-warning/10 text-warning border-warning/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                        }`}
                      >
                        {statusLabel(check.status)}
                      </Badge>
                      {check.latency != null && (
                        <span className="text-[10px] text-muted-foreground mono">{check.latency}ms</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Latência */}
        <TabsContent value="latency">
          <Card>
            <CardContent className="pt-5">
              <h2 className="text-sm font-semibold mb-1">Histórico de Velocidade</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Mostra o tempo de resposta da Base de Dados e Autenticação. Clique em "Verificar Agora" várias vezes para acumular dados.
              </p>
              {latencyHistory.length > 1 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={latencyHistory}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="time" className="text-xs" />
                      <YAxis className="text-xs" unit="ms" />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                        formatter={(value: number, name: string) => [
                          `${value}ms`,
                          name === "db" ? "Base de Dados" : "Autenticação"
                        ]}
                      />
                      <Bar dataKey="db" name="Base de Dados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="auth" name="Autenticação" fill="hsl(var(--chart-3, var(--primary)))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Ainda só tem 1 verificação.</p>
                  <p className="text-xs mt-1">Clique em "Verificar Agora" mais vezes para gerar o gráfico de velocidade.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Base de dados */}
        <TabsContent value="database">
          <Card>
            <CardContent className="pt-5">
              <h2 className="text-sm font-semibold mb-1">Registos por Tabela</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Número total de registos em cada tabela principal do sistema.
              </p>
              {tableStats.length > 0 ? (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tableStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="table" type="category" width={120} className="text-xs" />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                        formatter={(value: number) => [`${value} registos`, "Total"]}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados disponíveis</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Eventos críticos */}
        <TabsContent value="events">
          <Card>
            <CardContent className="pt-5">
              <h2 className="text-sm font-semibold mb-1">Últimos Eventos Críticos</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Ações importantes como eliminação de oficinas, suspensões e erros do sistema.
              </p>
              {recentErrors.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-10 h-10 text-success mx-auto mb-3" />
                  <p className="font-medium">Nenhum evento crítico recente</p>
                  <p className="text-xs text-muted-foreground mt-1">O sistema está a funcionar sem problemas.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentErrors.map((err, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                      <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{err.action}</Badge>
                          <span className="text-[10px] text-muted-foreground mono">{err.time}</span>
                        </div>
                        {err.details && err.details !== "null" && err.details !== "{}" && (
                          <p className="text-xs text-muted-foreground mt-1 break-words">{err.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
