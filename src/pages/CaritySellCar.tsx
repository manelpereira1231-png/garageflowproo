import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft, Car, Loader2, Lock } from "lucide-react";
import StructuredPhotoUpload, { getDefaultPhotoSlots, getPhotoUrls, areRequiredPhotosFilled, type PhotoSlot } from "@/components/StructuredPhotoUpload";
import MarketKYCFlow from "@/components/MarketKYCFlow";
import ConnectOnboardingGate from "@/components/ConnectOnboardingGate";
import { useCountryPricing } from "@/hooks/useCountryPricing";

const FUEL_OPTIONS = ['Gasóleo', 'Gasolina', 'Híbrido', 'Elétrico', 'GPL'];

export default function CaritySellCar() {
  const navigate = useNavigate();
  const { pricing, formatPrice } = useCountryPricing();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [connectReady, setConnectReady] = useState(false);
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>(getDefaultPhotoSlots());

  const [form, setForm] = useState({
    make: '', model: '', year: new Date().getFullYear(), mileage: 0,
    fuel: 'Gasóleo', plate: '', vin: '', price: 0, description: '',
  });

  const [sellerForm, setSellerForm] = useState({
    name: '', phone: '', location: '',
  });

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Precisa de uma conta para vender. Faça login primeiro.");
      navigate("/market/auth?mode=signup&redirect=/market/sell");
      return;
    }
    setUser(user);
    const { data: profile } = await supabase
      .from("carity_seller_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (profile) {
      setSellerProfile(profile);
      setSellerForm({ name: profile.name, phone: profile.phone, location: profile.location });
    }
  };

  // Photo upload is now handled by StructuredPhotoUpload component

  const kycApproved = sellerProfile?.kyc_status === "approved";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!kycApproved) {
      toast.error("Verificação de identidade obrigatória antes de publicar.");
      return;
    }
    if (!connectReady) {
      toast.error("Ative a sua conta de pagamentos antes de publicar.");
      return;
    }
    if (!form.make || !form.model || !form.price || !form.plate) { toast.error("Preencha todos os campos obrigatórios"); return; }
    if (!areRequiredPhotosFilled(photoSlots)) { toast.error("Preencha todas as fotos obrigatórias do veículo"); return; }
    if (!sellerForm.name || !sellerForm.phone) { toast.error("Preencha os dados de contacto do vendedor"); return; }

    setLoading(true);
    try {
      if (!sellerProfile) {
        await supabase.from("carity_seller_profiles").insert({ user_id: user.id, name: sellerForm.name, phone: sellerForm.phone, location: sellerForm.location });
      } else {
        await supabase.from("carity_seller_profiles").update({ name: sellerForm.name, phone: sellerForm.phone, location: sellerForm.location }).eq("id", sellerProfile.id);
      }

      const photoUrls = getPhotoUrls(photoSlots);
      const { data: listing, error } = await supabase.from("carity_listings").insert({
        seller_id: user.id, make: form.make, model: form.model, year: form.year, mileage: form.mileage,
        fuel: form.fuel, plate: form.plate.toUpperCase(), vin: form.vin || null, price: form.price,
        description: form.description, photos: photoUrls, status: 'pending_payment',
      }).select().single();

      if (error) {
        if (error.message?.includes("VIN_DUPLICATE") || error.code === "23505") {
          throw new Error("Já existe um anúncio ativo com este VIN. Cada veículo só pode ter um anúncio ativo na plataforma.");
        }
        throw error;
      }
      toast.success("Anúncio criado! Agora pague a taxa de inspeção para continuar.");
      navigate(`/market/pay/${listing.id}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar anúncio");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-slate-900 text-white px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
            <span className="text-xl font-bold">GarageFlow <span className="text-amber-400">Market</span></span>
          </Link>
          <Link to="/market">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Vender o meu carro</h1>
          <p className="text-muted-foreground">
            Preencha os dados do veículo. Depois será necessário pagar {formatPrice(pricing.inspection_price)} para a inspeção oficial.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* KYC Gate — required before publishing */}
          {user && (
            <MarketKYCFlow
              userId={user.id}
              profile={sellerProfile}
              onComplete={(updated) => setSellerProfile(updated)}
            />
          )}

          <Card>
            <CardHeader><CardTitle className="text-lg">Dados do Vendedor</CardTitle><CardDescription>As suas informações de contacto</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>Nome *</Label><Input value={sellerForm.name} onChange={e => setSellerForm(p => ({ ...p, name: e.target.value }))} placeholder="Seu nome" /></div>
              <div><Label>Telefone *</Label><Input value={sellerForm.phone} onChange={e => setSellerForm(p => ({ ...p, phone: e.target.value }))} placeholder="+351 9XX XXX XXX" /></div>
              <div><Label>Localização</Label><Input value={sellerForm.location} onChange={e => setSellerForm(p => ({ ...p, location: e.target.value }))} placeholder="Lisboa, Porto..." /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Dados do Veículo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><Label>Marca *</Label><Input value={form.make} onChange={e => setForm(p => ({ ...p, make: e.target.value }))} placeholder="BMW, Mercedes..." /></div>
                <div><Label>Modelo *</Label><Input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} placeholder="Série 3, Classe A..." /></div>
                <div><Label>Ano *</Label><Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: parseInt(e.target.value) || 2020 }))} /></div>
                <div><Label>Quilometragem *</Label><Input type="number" value={form.mileage} onChange={e => setForm(p => ({ ...p, mileage: parseInt(e.target.value) || 0 }))} /></div>
                <div><Label>Combustível *</Label>
                  <Select value={form.fuel} onValueChange={v => setForm(p => ({ ...p, fuel: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FUEL_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>Matrícula *</Label><Input value={form.plate} onChange={e => setForm(p => ({ ...p, plate: e.target.value }))} placeholder="AA-00-BB" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>VIN (opcional)</Label><Input value={form.vin} onChange={e => setForm(p => ({ ...p, vin: e.target.value }))} placeholder="Número de chassis" /></div>
                <div><Label>Preço ({pricing.currency_symbol}) *</Label><Input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descreva o estado do carro, extras, histórico..." rows={4} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fotos do Veículo</CardTitle>
              <CardDescription>
                Upload estruturado obrigatório. Cada slot corresponde a uma vista específica do veículo.
                As fotos não podem ser alteradas após submissão.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user && (
                <StructuredPhotoUpload
                  userId={user.id}
                  photos={photoSlots}
                  onChange={setPhotoSlots}
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="h-8 w-8 text-amber-500" />
                <div>
                  <h3 className="font-semibold">Taxa de Inspeção: {formatPrice(pricing.inspection_price)}</h3>
                  <p className="text-sm text-muted-foreground">Após submeter, será redirecionado para pagamento. Uma oficina certificada fará a inspeção completa do seu carro.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold disabled:opacity-60" disabled={loading || !kycApproved}>
            {!kycApproved ? <Lock className="h-4 w-4 mr-2" /> : loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Car className="h-4 w-4 mr-2" />}
            {!kycApproved ? "Verificação de identidade obrigatória" : `Submeter e pagar inspeção (${formatPrice(pricing.inspection_price)})`}
          </Button>
        </form>
      </div>
    </div>
  );
}
