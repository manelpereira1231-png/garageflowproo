import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Database, Mail, Zap, Server, Clock, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface HealthCheck {
  name: string;
  status: "healthy" | "warning" | "error";
  latency?: number;
  details?: string;
  icon: any;
}

export default function AdminSystemHealth() {
  const { t } = useLanguage();
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [emailStats, setEmailStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [shopCount, setShopCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const runHealthCheck = async () => {
    setLoading(true);
    const results: HealthCheck[] = [];

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

    const { data: emails, count: emailCount } = await supabase.from("email_logs").select("status", { count: "exact" }).gte("created_at", new Date(Date.now() - 86400000).toISOString());
    const sent = emails?.filter(e => e.status === "sent").length || 0;
    const failed = emails?.filter(e => e.status === "failed").length || 0;
    setEmailStats({ total: emailCount || 0, sent, failed });
    results.push({
      name: "Email Service",
      status: failed > sent * 0.5 ? "error" : failed > 0 ? "warning" : "healthy",
      details: `${sent} sent, ${failed} failed (24h)`,
      icon: Mail,
    });

    const { count: automationCount } = await supabase.from("automation_rules").select("id", { count: "exact", head: true });
    results.push({
      name: "Automations Engine",
      status: "healthy",
      details: `${automationCount || 0} ${t('admin.health.activeRules')}`,
      icon: Zap,
    });

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{t('admin.health.shops')}</p><p className="text-2xl font-bold">{shopCount}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{t('admin.health.users')}</p><p className="text-2xl font-bold">{userCount}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{t('admin.health.emails24h')}</p><p className="text-2xl font-bold">{emailStats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{t('admin.health.emailsFailed')}</p><p className="text-2xl font-bold text-destructive">{emailStats.failed}</p></CardContent></Card>
      </div>

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
