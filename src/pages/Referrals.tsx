import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Copy, Gift, Users, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

interface ReferralCode {
  id: string;
  code: string;
  free_months_balance: number;
  paid_referrals_count: number;
}

interface Referral {
  id: string;
  referred_user_id: string | null;
  referral_code: string;
  status: string;
  plan: string | null;
  payment_confirmed: boolean;
  reward_given: boolean;
  created_at: string;
}

export default function Referrals() {
  const { t } = useLanguage();
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'GF-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get or create referral code
    let { data: codeData } = await supabase
      .from("referral_codes")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!codeData) {
      const newCode = generateCode();
      const { data: created } = await supabase
        .from("referral_codes")
        .insert({ user_id: user.id, code: newCode })
        .select()
        .single();
      codeData = created;
    }

    if (codeData) setReferralCode(codeData as unknown as ReferralCode);

    // Load referrals
    const { data: refs } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_user_id", user.id)
      .order("created_at", { ascending: false });

    if (refs) setReferrals(refs as unknown as Referral[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const copyLink = () => {
    if (!referralCode) return;
    const link = `${window.location.origin}/auth?mode=signup&ref=${referralCode.code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const paidCount = referralCode?.paid_referrals_count || 0;
  const bonusProgress = Math.min((paidCount / 5) * 100, 100);
  const freeMonths = referralCode?.free_months_balance || 0;

  const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    pending: { icon: <Clock className="w-3.5 h-3.5" />, color: "bg-muted text-muted-foreground", label: "Pendente" },
    trial: { icon: <Clock className="w-3.5 h-3.5" />, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Trial" },
    paid: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", label: "Pago" },
    rejected: { icon: <XCircle className="w-3.5 h-3.5" />, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", label: "Rejeitado" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🎁 Programa de Referências</h1>
        <p className="text-muted-foreground">Ganhe 1 mês grátis por cada oficina que se torne cliente pago</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Gift className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold">{freeMonths}</p>
            <p className="text-sm text-muted-foreground">Meses grátis disponíveis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold">{paidCount}</p>
            <p className="text-sm text-muted-foreground">Referências pagas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold">{referrals.length}</p>
            <p className="text-sm text-muted-foreground">Total de convites</p>
          </CardContent>
        </Card>
      </div>

      {/* Share Link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">O seu link de referência</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-muted px-4 py-3 rounded-lg text-sm font-mono break-all">
              {referralCode ? `${window.location.origin}/auth?mode=signup&ref=${referralCode.code}` : '...'}
            </code>
            <Button onClick={copyLink} size="sm" className="shrink-0">
              <Copy className="w-4 h-4 mr-1" /> Copiar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Partilhe este link com outras oficinas. Quando se registarem e pagarem um plano Pro ou Garage, ganha 1 mês grátis.
          </p>
        </CardContent>
      </Card>

      {/* Bonus Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔥 Bónus: 5 referências = +3 meses grátis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={bonusProgress} className="h-3" />
          <p className="text-sm text-muted-foreground">{paidCount}/5 referências pagas</p>
          {paidCount >= 5 && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              ✅ Bónus desbloqueado!
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Referral List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de convites</CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ainda não tem referências. Partilhe o seu link!
            </p>
          ) : (
            <div className="space-y-3">
              {referrals.map(ref => {
                const cfg = statusConfig[ref.status] || statusConfig.pending;
                return (
                  <div key={ref.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Convite #{ref.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ref.created_at).toLocaleDateString('pt-PT')}
                          {ref.plan && ref.plan !== 'Free' && ` · Plano ${ref.plan}`}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${cfg.color} gap-1`}>
                      {cfg.icon} {cfg.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
