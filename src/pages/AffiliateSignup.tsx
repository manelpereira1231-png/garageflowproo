import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  Wrench, Users, TrendingUp, DollarSign, Shield, CheckCircle, Copy, 
  Rocket, Award, ArrowRight, Sparkles
} from "lucide-react";

export default function AffiliateSignup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ id: string; link: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      // Check for duplicate
      const { data: existing } = await supabase
        .from("partners")
        .select("id")
        .eq("contact_email", form.email.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        toast.error("Já existe um afiliado registado com este email.");
        setLoading(false);
        return;
      }

      // Create the affiliate
      const { data, error } = await supabase.from("partners").insert([{
        name: form.name.trim(),
        contact_email: form.email.toLowerCase().trim(),
        contact_phone: form.phone.trim(),
        type: "affiliate",
        commission_percentage: 10,
        discount_percentage: 0,
        payout_method: "bank_transfer",
        status: "active",
      }] as any).select().single();

      if (error) throw error;

      const partnerId = (data as any).id;
      const link = `${window.location.origin}/auth?mode=signup&partner=${partnerId}`;

      // Log the action
      await supabase.from("partner_logs").insert({
        partner_id: partnerId,
        action: "affiliate_self_registered",
        details: { name: form.name, email: form.email, source: "public_signup" },
      } as any);

      setCreated({ id: partnerId, link });
      toast.success("Registo concluído com sucesso! 🎉");
    } catch (err: any) {
      toast.error(err.message || "Erro ao registar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (created?.link) {
      navigator.clipboard.writeText(created.link);
      toast.success("Link copiado! 📋");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Garage<span className="text-primary">Flow</span></span>
          </button>
          <Button variant="outline" size="sm" onClick={() => navigate("/auth?mode=login")}>
            Já sou afiliado — Entrar
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4 gap-1 px-3 py-1">
            <Sparkles className="w-3.5 h-3.5" /> Programa de Afiliados
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Ganhe dinheiro a recomendar o <span className="text-primary">GarageFlow</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Torne-se afiliado, receba o seu link único e ganhe comissões automáticas por cada oficina que se registar através de si.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="text-center border-2 hover:border-primary/30 transition-colors">
            <CardContent className="pt-8 pb-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-2">Comissões Generosas</h3>
              <p className="text-muted-foreground text-sm mb-3">Ganhe por cada oficina que pagar um plano</p>
              <div className="flex justify-center gap-3">
                <Badge variant="outline" className="text-sm font-semibold">Pro: 10%</Badge>
                <Badge variant="outline" className="text-sm font-semibold">Garage: 20%</Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="text-center border-2 hover:border-primary/30 transition-colors">
            <CardContent className="pt-8 pb-6">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">Rastreio Automático</h3>
              <p className="text-muted-foreground text-sm">Cada oficina registada pelo seu link é automaticamente rastreada e vinculada a si.</p>
            </CardContent>
          </Card>
          <Card className="text-center border-2 hover:border-primary/30 transition-colors">
            <CardContent className="pt-8 pb-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">100% Transparente</h3>
              <p className="text-muted-foreground text-sm">Auditoria completa de todos os convites, conversões e pagamentos.</p>
            </CardContent>
          </Card>
        </div>

        {/* Signup Form / Success */}
        <div className="max-w-lg mx-auto">
          {!created ? (
            <Card className="border-2 shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-xl flex items-center justify-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  Registar como Afiliado
                </CardTitle>
                <CardDescription>Crie a sua conta gratuitamente em segundos</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="af-name">Nome Completo *</Label>
                    <Input 
                      id="af-name" 
                      placeholder="João Silva" 
                      value={form.name} 
                      onChange={e => setForm({ ...form, name: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="af-email">Email *</Label>
                    <Input 
                      id="af-email" 
                      type="email" 
                      placeholder="joao@exemplo.com" 
                      value={form.email} 
                      onChange={e => setForm({ ...form, email: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="af-phone">Telefone</Label>
                    <Input 
                      id="af-phone" 
                      placeholder="+351 912 345 678" 
                      value={form.phone} 
                      onChange={e => setForm({ ...form, phone: e.target.value })} 
                    />
                  </div>
                  <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Award className="w-5 h-5 mr-2" />
                        Tornar-me Afiliado
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-green-500/30 shadow-lg">
              <CardContent className="pt-8 pb-8 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Bem-vindo ao programa! 🎉</h2>
                  <p className="text-muted-foreground">O seu registo foi concluído. Copie o seu link único e comece a partilhar.</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">O seu link de afiliado</Label>
                  <div className="flex items-center gap-2">
                    <Input value={created.link} readOnly className="text-sm font-mono" />
                    <Button onClick={copyLink} size="icon" variant="outline" className="shrink-0">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Cada oficina que se registar através deste link será rastreada automaticamente.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={copyLink} className="gap-2">
                    <Copy className="w-4 h-4" /> Copiar Link
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/")}>
                    <ArrowRight className="w-4 h-4 mr-2" /> Voltar ao site
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* How it works */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-8">Como funciona?</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Registe-se", desc: "Preencha o formulário acima" },
              { step: "2", title: "Receba o link", desc: "Link único gerado automaticamente" },
              { step: "3", title: "Partilhe", desc: "Envie a oficinas que conhece" },
              { step: "4", title: "Ganhe", desc: "Comissão automática por cada plano pago" },
            ].map(item => (
              <div key={item.step} className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                  {item.step}
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
