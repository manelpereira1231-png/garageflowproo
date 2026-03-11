import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Database, Mail, Zap, Server, Clock, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

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

  const runHealthCheck = async () => {
    setLoading(true);
    const results: HealthCheck[] = [];

    // DB connectivity
    const dbStart = Date.now();
    const { error: dbErr } = await supabase.from("shops").select("id", { count: "exact", head: true });
    const dbLatency = Date.now() - dbStart;
    results.push({
      name: "Database",
      status: dbErr ? "error" : dbLatency > 2000 ? "warning" : "healthy",
      latency: dbLatency,
      details: dbErr ? dbErr.message : `${dbLatency}ms`,
      icon: Database,
    });

    // Auth service
    const authStart = Date.now();
    const { error: authErr } = await supabase.auth.getSession();
    const authLatency = Date.now() - authStart;
    results.push({
      name: "Auth Service",
      status: authErr ? "error" : authLatency > 3000 ? "warning" : "healthy",
      latency: authLatency,
      details: authErr ? authErr.message : `${authLatency}ms`,
      icon: Server,
    });

    // Email logs
    const { data: emails, count: emailCount } = await supabase.from("email_logs").select("status", { count: "exact" }).gte("created_at", new Date(Date.now() - 86400000).toISOString());
    const sent = emails?.filter(e => e.status === "sent").length || 0;
    const failed = emails?.filter(e => e.status === "failed").length || 0;
    setEmailStats({ total: emailCount || 0, sent, failed });
    results.push({
      name: "Email Service",
      status: failed > sent * 0.5 ? "error" : failed > 0 ? "warning" : "healthy",
      details: `${sent} enviados, ${failed} falhados (24h)`,
      icon: Mail,
    });

    // Automation rules
    const { count: automationCount } = await supabase.from("automation_rules").select("id", { count: "exact", head: true });
    results.push({
      name: "Automations Engine",
      status: "healthy",
      details: `${automationCount || 0} regras ativas`,
      icon: Zap,
    });

    // Counts
    const { count: shops } = await supabase.from("shops").select("id", { count: "exact", head: true });
    const { count: users } = await supabase.from("shop_users").select("id", { count: "exact", head: true });
    setShopCount(shops || 0);
    setUserCount(users || 0);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2"><Activity className="w-6 h-6 text-primary" /> System Health</h1>
          <p className="text-muted-foreground text-sm">Monitorização em tempo real da plataforma.</p>
        </div>
        <Button variant="outline" onClick={runHealthCheck} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Overall status */}
      <Card className={overallStatus === "healthy" ? "border-green-500/30 bg-green-500/5" : overallStatus === "warning" ? "border-yellow-500/30 bg-yellow-500/5" : "border-red-500/30 bg-red-500/5"}>
        <CardContent className="pt-5">
          <div className="flex items-center gap-3">
            {statusIcon(overallStatus)}
            <div>
              <p className="font-semibold">{overallStatus === "healthy" ? "Todos os sistemas operacionais" : overallStatus === "warning" ? "Alguns avisos detectados" : "Problemas detectados"}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Última verificação: {lastCheck.toLocaleTimeString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Oficinas</p><p className="text-2xl font-bold">{shopCount}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Utilizadores</p><p className="text-2xl font-bold">{userCount}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Emails (24h)</p><p className="text-2xl font-bold">{emailStats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Emails Falhados</p><p className="text-2xl font-bold text-destructive">{emailStats.failed}</p></CardContent></Card>
      </div>

      {/* Health checks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {checks.map((check, i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <check.icon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{check.name}</p>
                    <p className="text-xs text-muted-foreground">{check.details}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {check.latency && <span className="text-xs text-muted-foreground">{check.latency}ms</span>}
                  {statusIcon(check.status)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
