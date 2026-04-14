import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, Car, ClipboardCheck, Camera, CheckCircle, AlertTriangle, XCircle, Loader2, Euro, Plus, X, Bell, ThumbsUp, ThumbsDown, MessageCircle, CalendarCheck, Phone, User } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const COMPONENT_KEYS = [
  { key: "engine_status", label: "Motor" },
  { key: "transmission_status", label: "Transmissão" },
  { key: "brakes_status", label: "Travões" },
  { key: "suspension_status", label: "Suspensão" },
  { key: "steering_status", label: "Direção" },
  { key: "tires_status", label: "Pneus" },
  { key: "electrical_status", label: "Sistema Elétrico" },
];

const STATUS_OPTIONS = [
  { value: "ok", label: "OK", icon: CheckCircle, color: "text-green-600" },
  { value: "problems", label: "Problemas", icon: AlertTriangle, color: "text-amber-500" },
  { value: "critical", label: "Crítico", icon: XCircle, color: "text-red-600" },
];

interface Defect {
  description: string;
  severity: "leve" | "medio" | "grave";
}

export default function CarityShopInspections() {
  const shopId = useActiveShopId();
  const [tab, setTab] = useState("offers");
  const [offers, setOffers] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInspection, setActiveInspection] = useState<any>(null);
  const [activeListing, setActiveListing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [shopData, setShopData] = useState<any>(null);

  // Schedule dialog
  const [scheduleDialog, setScheduleDialog] = useState<any>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // Report form state
  const [report, setReport] = useState({
    engine_status: "ok", transmission_status: "ok", brakes_status: "ok",
    suspension_status: "ok", steering_status: "ok", tires_status: "ok",
    electrical_status: "ok", overall_score: 7, recommendation: "recommended",
    inspector_notes: "",
  });
  const [defects, setDefects] = useState<Defect[]>([]);
  const [photoSections, setPhotoSections] = useState<Record<string, string[]>>({
    exterior_photos: [], interior_photos: [], engine_photos: [],
    tire_photos: [], damage_photos: [],
  });
  const [uploading, setUploading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!shopId) return;

    const [offersRes, inspectionsRes, shopRes] = await Promise.all([
      supabase
        .from("carity_inspection_offers")
        .select("*, carity_listings(*)")
        .eq("shop_id", shopId)
        .eq("status", "pending")
        .order("offered_at", { ascending: false }),
      supabase
        .from("carity_inspections")
        .select("*, carity_listings(*)")
        .eq("shop_id", shopId)
        .order("assigned_at", { ascending: false }),
      supabase
        .from("shops")
        .select("id, name, address, phone, latitude, longitude")
        .eq("id", shopId)
        .single(),
    ]);

    if (shopRes.data) setShopData(shopRes.data);

    setOffers((offersRes.data || []).map((o: any) => ({
      ...o,
      listing: o.carity_listings ? { ...o.carity_listings, photos: Array.isArray(o.carity_listings.photos) ? o.carity_listings.photos : [] } : null,
    })));

    // Fetch seller profiles for inspections
    const inspArr = (inspectionsRes.data || []).map((i: any) => ({
      ...i,
      listing: i.carity_listings ? { ...i.carity_listings, photos: Array.isArray(i.carity_listings.photos) ? i.carity_listings.photos : [] } : null,
    }));

    // Get seller info for each listing
    const sellerIds = [...new Set(inspArr.filter((i: any) => i.listing?.seller_id).map((i: any) => i.listing.seller_id))];
    let sellersMap: Record<string, any> = {};
    if (sellerIds.length > 0) {
      const { data: sellers } = await supabase
        .from("carity_seller_profiles")
        .select("*")
        .in("user_id", sellerIds);
      (sellers || []).forEach((s: any) => { sellersMap[s.user_id] = s; });
    }

    const enriched = inspArr.map((i: any) => ({
      ...i,
      seller: i.listing?.seller_id ? sellersMap[i.listing.seller_id] || null : null,
    }));

    setInspections(enriched);
    setLoading(false);
  }, [shopId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Accept inspection offer
  const acceptOffer = async (offer: any) => {
    setRespondingId(offer.id);
    try {
      await supabase.from("carity_inspection_offers")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", offer.id);

      await supabase.from("carity_inspections").insert({
        listing_id: offer.listing_id,
        shop_id: shopId!,
        payment_status: "paid",
        status: "pending",
      });

      await supabase.from("carity_listings")
        .update({ status: "pending_inspection", shop_id: shopId })
        .eq("id", offer.listing_id);

      await supabase.from("carity_inspection_offers")
        .update({ status: "rejected", responded_at: new Date().toISOString(), rejection_reason: "Outra oficina aceitou" })
        .eq("inspection_id", offer.inspection_id)
        .neq("id", offer.id)
        .eq("status", "pending");

      toast.success("Inspeção aceite! Contacte o vendedor para agendar.");
      setTab("active");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao aceitar inspeção");
    } finally {
      setRespondingId(null);
    }
  };

  const rejectOffer = async (offerId: string) => {
    setRespondingId(offerId);
    try {
      await supabase.from("carity_inspection_offers")
        .update({ status: "rejected", responded_at: new Date().toISOString(), rejection_reason: "Recusado pela oficina" })
        .eq("id", offerId);
      toast.success("Pedido recusado.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao recusar");
    } finally {
      setRespondingId(null);
    }
  };

  // WhatsApp message to seller
  const openWhatsAppToSeller = (inspection: any) => {
    const seller = inspection.seller;
    const listing = inspection.listing;
    if (!seller?.phone) { toast.error("Vendedor sem telefone registado"); return; }

    const shopName = shopData?.name || "a oficina";
    const shopAddr = shopData?.address || "";

    const message = `Olá! 👋\n\nSou da oficina ${shopName}.\n\nRecebemos o pedido de inspeção do seu ${listing?.make || ""} ${listing?.model || ""} (${listing?.plate || ""}).\n\n📍 Morada: ${shopAddr}\n\nPode confirmar quando tem disponibilidade para trazer o veículo?\n\nObrigado!`;

    const phone = seller.phone;
    let cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
    if (!cleaned.startsWith('+') && !cleaned.startsWith('351')) cleaned = '351' + cleaned;
    cleaned = cleaned.replace('+', '');

    const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");

    // Mark as contacted
    supabase.from("carity_inspections")
      .update({ seller_contacted_at: new Date().toISOString(), seller_notified: true } as any)
      .eq("id", inspection.id)
      .then(() => loadData());
  };

  // Schedule confirmation
  const confirmSchedule = async () => {
    if (!scheduleDialog || !schedDate || !schedTime) return;
    setScheduling(true);
    try {
      await supabase.from("carity_inspections")
        .update({
          scheduled_date: schedDate,
          scheduled_time: schedTime,
          status: "scheduled",
        } as any)
        .eq("id", scheduleDialog.id);

      toast.success("Inspeção agendada com sucesso!");
      setScheduleDialog(null);
      setSchedDate("");
      setSchedTime("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao agendar");
    } finally {
      setScheduling(false);
    }
  };

  const startInspection = async (inspection: any) => {
    setActiveInspection(inspection);
    setActiveListing(inspection.listing);

    const { data: existing } = await supabase
      .from("carity_inspection_reports")
      .select("*")
      .eq("inspection_id", inspection.id)
      .maybeSingle();

    if (existing) {
      setReport({
        engine_status: existing.engine_status,
        transmission_status: existing.transmission_status,
        brakes_status: existing.brakes_status,
        suspension_status: existing.suspension_status,
        steering_status: existing.steering_status,
        tires_status: existing.tires_status,
        electrical_status: existing.electrical_status,
        overall_score: existing.overall_score,
        recommendation: existing.recommendation,
        inspector_notes: existing.inspector_notes || "",
      });
      setDefects(Array.isArray(existing.defects) ? (existing.defects as unknown as Defect[]) : []);
      setPhotoSections({
        exterior_photos: Array.isArray(existing.exterior_photos) ? existing.exterior_photos as string[] : [],
        interior_photos: Array.isArray(existing.interior_photos) ? existing.interior_photos as string[] : [],
        engine_photos: Array.isArray(existing.engine_photos) ? existing.engine_photos as string[] : [],
        tire_photos: Array.isArray(existing.tire_photos) ? existing.tire_photos as string[] : [],
        damage_photos: Array.isArray(existing.damage_photos) ? existing.damage_photos as string[] : [],
      });
    } else {
      setReport({ engine_status: "ok", transmission_status: "ok", brakes_status: "ok", suspension_status: "ok", steering_status: "ok", tires_status: "ok", electrical_status: "ok", overall_score: 7, recommendation: "recommended", inspector_notes: "" });
      setDefects([]);
      setPhotoSections({ exterior_photos: [], interior_photos: [], engine_photos: [], tire_photos: [], damage_photos: [] });
    }

    if (inspection.status === 'pending' || inspection.status === 'scheduled') {
      await supabase.from("carity_inspections")
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq("id", inspection.id);

      await supabase.from("carity_listings")
        .update({ status: 'inspecting' })
        .eq("id", inspection.listing_id);
    }
  };

  const handlePhotoUpload = async (section: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setUploading(section);
    const newPhotos: string[] = [];
    for (const file of Array.from(e.target.files)) {
      const ext = file.name.split('.').pop();
      const path = `inspections/${activeInspection.id}/${section}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("carity-photos").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("carity-photos").getPublicUrl(path);
        newPhotos.push(data.publicUrl);
      }
    }
    setPhotoSections(prev => ({ ...prev, [section]: [...prev[section], ...newPhotos] }));
    setUploading(null);
  };

  const addDefect = () => setDefects(prev => [...prev, { description: "", severity: "leve" }]);
  const removeDefect = (i: number) => setDefects(prev => prev.filter((_, idx) => idx !== i));

  const submitReport = async () => {
    if (!activeInspection || !shopId) return;
    if (photoSections.exterior_photos.length < 1) { toast.error("Carregue pelo menos 1 foto do exterior"); return; }
    if (photoSections.interior_photos.length < 1) { toast.error("Carregue pelo menos 1 foto do interior"); return; }

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("carity_inspection_reports").select("id").eq("inspection_id", activeInspection.id).maybeSingle();

      const reportData = {
        inspection_id: activeInspection.id, listing_id: activeInspection.listing_id, shop_id: shopId,
        ...report,
        defects: defects.filter(d => d.description.trim()) as unknown as any,
        exterior_photos: photoSections.exterior_photos as unknown as any,
        interior_photos: photoSections.interior_photos as unknown as any,
        engine_photos: photoSections.engine_photos as unknown as any,
        tire_photos: photoSections.tire_photos as unknown as any,
        damage_photos: photoSections.damage_photos as unknown as any,
        completed_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("carity_inspection_reports").update(reportData).eq("id", existing.id);
      } else {
        await supabase.from("carity_inspection_reports").insert(reportData);
      }

      await supabase.from("carity_inspections")
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq("id", activeInspection.id);

      await supabase.from("carity_listings")
        .update({ status: 'pending_approval' })
        .eq("id", activeInspection.listing_id);

      toast.success("Relatório de inspeção enviado com sucesso!");
      setActiveInspection(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar relatório");
    } finally {
      setSaving(false);
    }
  };

  // --- INSPECTION FORM VIEW ---
  if (activeInspection && activeListing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-amber-500" />
              Inspeção GarageFlow Market
            </h1>
            <p className="text-muted-foreground">
              {activeListing.make} {activeListing.model} ({activeListing.year}) · {activeListing.plate}
            </p>
          </div>
          <Button variant="outline" onClick={() => setActiveInspection(null)}>Voltar</Button>
        </div>

        {/* Seller info */}
        {activeInspection.seller && (
          <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-900/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-blue-500" />
                <div className="flex-1">
                  <p className="font-semibold">{activeInspection.seller.name}</p>
                  <p className="text-sm text-muted-foreground">{activeInspection.seller.phone} · {activeInspection.seller.location}</p>
                </div>
                {activeInspection.seller.phone && (
                  <Button size="sm" variant="outline" className="border-green-200 text-green-700" onClick={() => openWhatsAppToSeller(activeInspection)}>
                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-lg">Dados do Veículo</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">Marca:</span> <strong>{activeListing.make}</strong></div>
              <div><span className="text-muted-foreground">Modelo:</span> <strong>{activeListing.model}</strong></div>
              <div><span className="text-muted-foreground">Ano:</span> <strong>{activeListing.year}</strong></div>
              <div><span className="text-muted-foreground">Km:</span> <strong>{activeListing.mileage?.toLocaleString()}</strong></div>
              <div><span className="text-muted-foreground">Combustível:</span> <strong>{activeListing.fuel}</strong></div>
              <div><span className="text-muted-foreground">Matrícula:</span> <strong>{activeListing.plate}</strong></div>
              {activeListing.vin && <div><span className="text-muted-foreground">VIN:</span> <strong>{activeListing.vin}</strong></div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Checklist Mecânico</CardTitle>
            <CardDescription>Avalie cada componente do veículo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {COMPONENT_KEYS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">{label}</span>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const selected = report[key as keyof typeof report] === opt.value;
                    return (
                      <Button key={opt.value} size="sm" variant={selected ? "default" : "outline"}
                        className={selected ? (opt.value === 'ok' ? 'bg-green-600' : opt.value === 'problems' ? 'bg-amber-500' : 'bg-red-600') : ''}
                        onClick={() => setReport(p => ({ ...p, [key]: opt.value }))}>
                        <Icon className="h-3.5 w-3.5 mr-1" />{opt.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fotos da Inspeção</CardTitle>
            <CardDescription>Carregue fotos obrigatórias do exterior, interior e motor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              { key: "exterior_photos", label: "Exterior (frente, trás, laterais)", required: true },
              { key: "interior_photos", label: "Interior", required: true },
              { key: "engine_photos", label: "Motor", required: false },
              { key: "tire_photos", label: "Pneus", required: false },
              { key: "damage_photos", label: "Danos encontrados", required: false },
            ].map(section => (
              <div key={section.key}>
                <Label className="mb-2 block">
                  {section.label} {section.required && <span className="text-red-500">*</span>}
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {photoSections[section.key].map((photo, i) => (
                    <div key={i} className="w-20 h-20 rounded overflow-hidden relative group">
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setPhotoSections(prev => ({ ...prev, [section.key]: prev[section.key].filter((_, idx) => idx !== i) }))}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-muted/50">
                    {uploading === section.key ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                    <input type="file" className="hidden" accept="image/*" multiple onChange={e => handlePhotoUpload(section.key, e)} />
                  </label>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Defeitos / Problemas</CardTitle>
            <CardDescription>Liste todos os problemas encontrados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {defects.map((defect, i) => (
              <div key={i} className="flex gap-2 items-start">
                <Input value={defect.description} onChange={e => { const u = [...defects]; u[i].description = e.target.value; setDefects(u); }} placeholder="Descreva o problema..." className="flex-1" />
                <Select value={defect.severity} onValueChange={v => { const u = [...defects]; u[i].severity = v as Defect["severity"]; setDefects(u); }}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leve">Leve</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="grave">Grave</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removeDefect(i)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addDefect}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar defeito</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Classificação Final</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-3 block">Estado Geral: <strong className="text-amber-500 text-xl">{report.overall_score}/10</strong></Label>
              <Slider value={[report.overall_score]} onValueChange={([v]) => setReport(p => ({ ...p, overall_score: v }))} max={10} min={0} step={0.5} className="py-2" />
            </div>
            <div>
              <Label className="mb-2 block">Recomendação</Label>
              <div className="flex gap-2">
                {[
                  { value: "recommended", label: "Recomendado", color: "bg-green-600" },
                  { value: "acceptable", label: "Aceitável", color: "bg-amber-500" },
                  { value: "not_recommended", label: "Não Recomendado", color: "bg-red-600" },
                ].map(opt => (
                  <Button key={opt.value} variant={report.recommendation === opt.value ? "default" : "outline"}
                    className={report.recommendation === opt.value ? opt.color : ''}
                    onClick={() => setReport(p => ({ ...p, recommendation: opt.value }))}>{opt.label}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label>Notas do Inspetor</Label>
              <Textarea value={report.inspector_notes} onChange={e => setReport(p => ({ ...p, inspector_notes: e.target.value }))} placeholder="Observações adicionais..." rows={4} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={submitReport} disabled={saving} size="lg" className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Submeter Relatório de Inspeção
        </Button>
      </div>
    );
  }

  // --- MAIN LIST VIEW ---
  const pendingOffers = offers.length;
  const activeInspections = inspections.filter(i => !['completed'].includes(i.status)).length;
  const completedInspections = inspections.filter(i => i.status === 'completed').length;
  const totalEarnings = inspections.filter(i => i.status === 'completed').reduce((sum, i) => sum + Number(i.shop_share || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
             <ShieldCheck className="h-6 w-6 text-amber-500" />
             Inspeções Market
          </h1>
          <p className="text-muted-foreground">Aceite pedidos de inspeção e ganhe por cada carro inspecionado</p>
        </div>
        <Badge variant="outline" className="text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800">
          <Euro className="h-3.5 w-3.5 mr-1" />
          €{totalEarnings.toFixed(2)} ganhos
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-4 text-center">
          <Bell className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold">{pendingOffers}</p>
          <p className="text-xs text-muted-foreground">Pedidos Pendentes</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <ClipboardCheck className="h-5 w-5 mx-auto text-blue-500 mb-1" />
          <p className="text-2xl font-bold">{activeInspections}</p>
          <p className="text-xs text-muted-foreground">Em Curso</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <CheckCircle className="h-5 w-5 mx-auto text-green-600 mb-1" />
          <p className="text-2xl font-bold">{completedInspections}</p>
          <p className="text-xs text-muted-foreground">Concluídas</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <Euro className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold">€{totalEarnings.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Ganhos Totais</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="offers" className="relative">
            Pedidos {pendingOffers > 0 && <Badge className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0">{pendingOffers}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="active">Em Curso ({activeInspections})</TabsTrigger>
          <TabsTrigger value="completed">Concluídas ({completedInspections})</TabsTrigger>
        </TabsList>

        {/* PENDING OFFERS */}
        <TabsContent value="offers" className="space-y-4 mt-4">
          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : offers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold mb-2">Sem pedidos de inspeção</h3>
                <p className="text-muted-foreground">Quando um carro precisar de inspeção, receberá o pedido aqui.</p>
              </CardContent>
            </Card>
          ) : (
            offers.map(offer => (
              <Card key={offer.id} className="border-amber-200 bg-amber-50/30 dark:bg-amber-900/5">
                <CardContent className="p-4">
                  <div className="flex gap-4 items-center">
                    <div className="w-20 h-14 rounded bg-muted flex-shrink-0 overflow-hidden">
                      {offer.listing?.photos?.[0] ? (
                        <img src={offer.listing.photos[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full"><Car className="h-5 w-5 text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Novo Pedido</Badge>
                      </div>
                      <h3 className="font-semibold">
                        {offer.listing?.make} {offer.listing?.model} ({offer.listing?.year})
                      </h3>
                      <p className="text-sm text-muted-foreground">{offer.listing?.plate} · {offer.listing?.mileage?.toLocaleString()} km</p>
                    </div>
                    <div className="text-right mr-2">
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">€5,97</p>
                      <p className="text-xs text-muted-foreground">por inspeção</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => acceptOffer(offer)}
                        disabled={respondingId === offer.id}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
                      >
                        {respondingId === offer.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ThumbsUp className="h-4 w-4 mr-1" />}
                        Aceitar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => rejectOffer(offer.id)}
                        disabled={respondingId === offer.id}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <ThumbsDown className="h-4 w-4 mr-1" />
                        Recusar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ACTIVE INSPECTIONS */}
        <TabsContent value="active" className="space-y-4 mt-4">
          {inspections.filter(i => i.status !== 'completed').length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Sem inspeções em curso</CardContent></Card>
          ) : (
            inspections.filter(i => i.status !== 'completed').map(inspection => {
              const seller = inspection.seller;
              const isScheduled = inspection.status === 'scheduled';
              const isPending = inspection.status === 'pending';
              const needsContact = isPending && !inspection.seller_contacted_at;

              return (
                <Card key={inspection.id} className={needsContact ? "border-amber-300 bg-amber-50/20 dark:bg-amber-900/5" : ""}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex gap-4 items-center">
                      <div className="w-20 h-14 rounded bg-muted flex-shrink-0 overflow-hidden">
                        {inspection.listing?.photos?.[0] ? (
                          <img src={inspection.listing.photos[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full"><Car className="h-5 w-5 text-muted-foreground/30" /></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{inspection.listing?.make} {inspection.listing?.model} ({inspection.listing?.year})</h3>
                        <p className="text-sm text-muted-foreground">{inspection.listing?.plate} · {inspection.listing?.mileage?.toLocaleString()} km</p>
                        {isScheduled && inspection.scheduled_date && (
                          <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-1 mt-1">
                            <CalendarCheck className="h-3.5 w-3.5" />
                            {inspection.scheduled_date}{inspection.scheduled_time ? ` às ${inspection.scheduled_time}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={
                          isPending ? 'bg-amber-100 text-amber-800' :
                          isScheduled ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }>
                          {isPending ? 'Aguarda contacto' : isScheduled ? 'Agendada' : 'Em curso'}
                        </Badge>
                      </div>
                    </div>

                    {/* Seller info + actions */}
                    {seller && (
                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{seller.name}</p>
                          <p className="text-xs text-muted-foreground">{seller.phone} · {seller.location}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      {/* WhatsApp to seller */}
                      {seller?.phone && (isPending || isScheduled) && (
                        <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => openWhatsAppToSeller(inspection)}>
                          <MessageCircle className="h-3.5 w-3.5 mr-1" />
                          {needsContact ? "Enviar WhatsApp ao vendedor" : "WhatsApp vendedor"}
                        </Button>
                      )}

                      {/* Schedule button */}
                      {(isPending || (isScheduled && !inspection.started_at)) && (
                        <Button size="sm" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => {
                          setScheduleDialog(inspection);
                          setSchedDate(inspection.scheduled_date || "");
                          setSchedTime(inspection.scheduled_time || "");
                        }}>
                          <CalendarCheck className="h-3.5 w-3.5 mr-1" />
                          {isScheduled ? "Reagendar" : "Agendar inspeção"}
                        </Button>
                      )}

                      {/* Start/continue inspection */}
                      <Button onClick={() => startInspection(inspection)} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold" size="sm">
                        <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                        {inspection.status === 'in_progress' ? 'Continuar inspeção' : 'Iniciar inspeção'}
                      </Button>
                    </div>

                    {needsContact && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/20 px-2 py-1 rounded">
                        ⚠️ Contacte o vendedor para agendar a inspeção
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* COMPLETED */}
        <TabsContent value="completed" className="space-y-4 mt-4">
          {inspections.filter(i => i.status === 'completed').length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Sem inspeções concluídas</CardContent></Card>
          ) : (
            inspections.filter(i => i.status === 'completed').map(inspection => (
              <Card key={inspection.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4 items-center">
                    <div className="w-20 h-14 rounded bg-muted flex-shrink-0 overflow-hidden">
                      {inspection.listing?.photos?.[0] ? (
                        <img src={inspection.listing.photos[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full"><Car className="h-5 w-5 text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{inspection.listing?.make} {inspection.listing?.model} ({inspection.listing?.year})</h3>
                      <p className="text-sm text-muted-foreground">{inspection.listing?.plate}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Concluída</Badge>
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">+€{Number(inspection.shop_share).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Schedule Dialog */}
      <Dialog open={!!scheduleDialog} onOpenChange={o => !o && setScheduleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-blue-500" />
              Agendar inspeção
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {scheduleDialog?.listing?.make} {scheduleDialog?.listing?.model} — {scheduleDialog?.listing?.plate}
          </p>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <Label>Hora *</Label>
              <Input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialog(null)}>Cancelar</Button>
            <Button onClick={confirmSchedule} disabled={!schedDate || !schedTime || scheduling} className="bg-blue-600 hover:bg-blue-500 text-white">
              {scheduling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CalendarCheck className="h-4 w-4 mr-1" />}
              Confirmar agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
