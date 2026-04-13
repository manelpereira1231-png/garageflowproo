import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Upload, ArrowLeft, Car, Camera, X, Loader2 } from "lucide-react";

const FUEL_OPTIONS = ['Gasóleo', 'Gasolina', 'Híbrido', 'Elétrico', 'GPL'];

export default function CaritySellCar() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    make: '', model: '', year: new Date().getFullYear(), mileage: 0,
    fuel: 'Gasóleo', plate: '', vin: '', price: 0, description: '',
  });

  const [sellerForm, setSellerForm] = useState({
    name: '', phone: '', location: '',
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Precisa de uma conta para vender. Faça login primeiro.");
      navigate("/auth");
      return;
    }
    setUser(user);

    // Check seller profile
    const { data: profile } = await supabase
      .from("carity_seller_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile) {
      setSellerProfile(profile);
      setSellerForm({ name: profile.name, phone: profile.phone, location: profile.location });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !user) return;
    setUploading(true);
    
    const newPhotos: string[] = [];
    for (const file of Array.from(e.target.files)) {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("carity-photos").upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("carity-photos").getPublicUrl(path);
        newPhotos.push(urlData.publicUrl);
      }
    }
    setPhotos(prev => [...prev, ...newPhotos]);
    setUploading(false);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!form.make || !form.model || !form.price || !form.plate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (photos.length < 3) {
      toast.error("Carregue pelo menos 3 fotos do veículo");
      return;
    }
    if (!sellerForm.name || !sellerForm.phone) {
      toast.error("Preencha os dados de contacto do vendedor");
      return;
    }

    setLoading(true);

    try {
      // Upsert seller profile
      if (!sellerProfile) {
        await supabase.from("carity_seller_profiles").insert({
          user_id: user.id,
          name: sellerForm.name,
          phone: sellerForm.phone,
          location: sellerForm.location,
        });
      } else {
        await supabase.from("carity_seller_profiles")
          .update({ name: sellerForm.name, phone: sellerForm.phone, location: sellerForm.location })
          .eq("id", sellerProfile.id);
      }

      // Create listing
      const { data: listing, error } = await supabase.from("carity_listings").insert({
        seller_id: user.id,
        make: form.make,
        model: form.model,
        year: form.year,
        mileage: form.mileage,
        fuel: form.fuel,
        plate: form.plate.toUpperCase(),
        vin: form.vin || null,
        price: form.price,
        description: form.description,
        photos: photos,
        status: 'pending_payment',
      }).select().single();

      if (error) throw error;

      toast.success("Anúncio criado! Agora pague a taxa de inspeção para continuar.");
      navigate(`/carity/pagar/${listing.id}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar anúncio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-emerald-700 text-white px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/carity" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            <span className="text-xl font-bold">Carity</span>
          </Link>
          <Link to="/carity">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Vender o meu carro</h1>
          <p className="text-muted-foreground">
            Preencha os dados do veículo. Depois será necessário pagar €19,90 para a inspeção oficial.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seller Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados do Vendedor</CardTitle>
              <CardDescription>As suas informações de contacto</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input value={sellerForm.name} onChange={e => setSellerForm(p => ({ ...p, name: e.target.value }))} placeholder="Seu nome" />
              </div>
              <div>
                <Label>Telefone *</Label>
                <Input value={sellerForm.phone} onChange={e => setSellerForm(p => ({ ...p, phone: e.target.value }))} placeholder="+351 9XX XXX XXX" />
              </div>
              <div>
                <Label>Localização</Label>
                <Input value={sellerForm.location} onChange={e => setSellerForm(p => ({ ...p, location: e.target.value }))} placeholder="Lisboa, Porto..." />
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados do Veículo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label>Marca *</Label>
                  <Input value={form.make} onChange={e => setForm(p => ({ ...p, make: e.target.value }))} placeholder="BMW, Mercedes..." />
                </div>
                <div>
                  <Label>Modelo *</Label>
                  <Input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} placeholder="Série 3, Classe A..." />
                </div>
                <div>
                  <Label>Ano *</Label>
                  <Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: parseInt(e.target.value) || 2020 }))} />
                </div>
                <div>
                  <Label>Quilometragem *</Label>
                  <Input type="number" value={form.mileage} onChange={e => setForm(p => ({ ...p, mileage: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Combustível *</Label>
                  <Select value={form.fuel} onValueChange={v => setForm(p => ({ ...p, fuel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FUEL_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Matrícula *</Label>
                  <Input value={form.plate} onChange={e => setForm(p => ({ ...p, plate: e.target.value }))} placeholder="AA-00-BB" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>VIN (opcional)</Label>
                  <Input value={form.vin} onChange={e => setForm(p => ({ ...p, vin: e.target.value }))} placeholder="Número de chassis" />
                </div>
                <div>
                  <Label>Preço (€) *</Label>
                  <Input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Descreva o estado do carro, extras, histórico..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fotos do Veículo</CardTitle>
              <CardDescription>Mínimo 3 fotos. Inclua exterior, interior e motor.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-4">
                {photos.map((photo, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Adicionar</span>
                    </>
                  )}
                  <input type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">{photos.length}/10 fotos carregadas (mínimo 3)</p>
            </CardContent>
          </Card>

          {/* Pricing info */}
          <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="h-8 w-8 text-emerald-600" />
                <div>
                  <h3 className="font-semibold">Taxa de Inspeção: €19,90</h3>
                  <p className="text-sm text-muted-foreground">
                    Após submeter, será redirecionado para pagamento. Uma oficina certificada fará a inspeção completa do seu carro.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Car className="h-4 w-4 mr-2" />}
            Submeter e pagar inspeção (€19,90)
          </Button>
        </form>
      </div>
    </div>
  );
}
