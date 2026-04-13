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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ShieldCheck, Car, ClipboardCheck, Camera, CheckCircle, AlertTriangle, XCircle, Loader2, Euro, Plus, X } from "lucide-react";

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
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInspection, setActiveInspection] = useState<any>(null);
  const [activeListing, setActiveListing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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

  const loadInspections = useCallback(async () => {
    if (!shopId) return;
    const { data } = await supabase
      .from("carity_inspections")
      .select("*, carity_listings(*)")
      .eq("shop_id", shopId)
      .eq("payment_status", "paid")
      .order("assigned_at", { ascending: false });

    setInspections((data || []).map((i: any) => ({
      ...i,
      listing: i.carity_listings ? {
        ...i.carity_listings,
        photos: Array.isArray(i.carity_listings.photos) ? i.carity_listings.photos : [],
      } : null,
    })));
    setLoading(false);
  }, [shopId]);

  useEffect(() => { loadInspections(); }, [loadInspections]);

  const startInspection = async (inspection: any) => {
    setActiveInspection(inspection);
    setActiveListing(inspection.listing);

    // Check existing report
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
      setDefects(Array.isArray(existing.defects) ? existing.defects as Defect[] : []);
      setPhotoSections({
        exterior_photos: Array.isArray(existing.exterior_photos) ? existing.exterior_photos as string[] : [],
        interior_photos: Array.isArray(existing.interior_photos) ? existing.interior_photos as string[] : [],
        engine_photos: Array.isArray(existing.engine_photos) ? existing.engine_photos as string[] : [],
        tire_photos: Array.isArray(existing.tire_photos) ? existing.tire_photos as string[] : [],
        damage_photos: Array.isArray(existing.damage_photos) ? existing.damage_photos as string[] : [],
      });
    }

    // Mark inspection as in_progress
    if (inspection.status === 'pending') {
      await supabase.from("carity_inspections")
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq("id", inspection.id);
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

    // Validate
    if (photoSections.exterior_photos.length < 1) {
      toast.error("Carregue pelo menos 1 foto do exterior"); return;
    }
    if (photoSections.interior_photos.length < 1) {
      toast.error("Carregue pelo menos 1 foto do interior"); return;
    }

    setSaving(true);
    try {
      // Check existing report
      const { data: existing } = await supabase
        .from("carity_inspection_reports")
        .select("id")
        .eq("inspection_id", activeInspection.id)
        .maybeSingle();

      const reportData = {
        inspection_id: activeInspection.id,
        listing_id: activeInspection.listing_id,
        shop_id: shopId,
        ...report,
        defects: defects.filter(d => d.description.trim()),
        ...photoSections,
        completed_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("carity_inspection_reports").update(reportData).eq("id", existing.id);
      } else {
        await supabase.from("carity_inspection_reports").insert(reportData);
      }

      // Update inspection status
      await supabase.from("carity_inspections")
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq("id", activeInspection.id);

      // Update listing status
      await supabase.from("carity_listings")
        .update({ status: 'pending_approval' })
        .eq("id", activeInspection.listing_id);

      toast.success("Relatório de inspeção enviado com sucesso!");
      setActiveInspection(null);
      loadInspections();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar relatório");
    } finally {
      setSaving(false);
    }
  };

  if (activeInspection && activeListing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-emerald-600" />
              Inspeção Carity
            </h1>
            <p className="text-muted-foreground">
              {activeListing.make} {activeListing.model} ({activeListing.year}) · {activeListing.plate}
            </p>
          </div>
          <Button variant="outline" onClick={() => setActiveInspection(null)}>Voltar</Button>
        </div>

        {/* Vehicle info */}
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

        {/* Checklist */}
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
                      <Button
                        key={opt.value}
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        className={selected ? (opt.value === 'ok' ? 'bg-green-600' : opt.value === 'problems' ? 'bg-amber-500' : 'bg-red-600') : ''}
                        onClick={() => setReport(p => ({ ...p, [key]: opt.value }))}
                      >
                        <Icon className="h-3.5 w-3.5 mr-1" />
                        {opt.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Photos */}
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
                      <button
                        onClick={() => setPhotoSections(prev => ({ ...prev, [section.key]: prev[section.key].filter((_, idx) => idx !== i) }))}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"
                      >
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

        {/* Defects */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Defeitos / Problemas</CardTitle>
            <CardDescription>Liste todos os problemas encontrados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {defects.map((defect, i) => (
              <div key={i} className="flex gap-2 items-start">
                <Input
                  value={defect.description}
                  onChange={e => {
                    const updated = [...defects];
                    updated[i].description = e.target.value;
                    setDefects(updated);
                  }}
                  placeholder="Descreva o problema..."
                  className="flex-1"
                />
                <Select
                  value={defect.severity}
                  onValueChange={v => {
                    const updated = [...defects];
                    updated[i].severity = v as Defect["severity"];
                    setDefects(updated);
                  }}
                >
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leve">Leve</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="grave">Grave</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removeDefect(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addDefect}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar defeito
            </Button>
          </CardContent>
        </Card>

        {/* Score & Recommendation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Classificação Final</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-3 block">Estado Geral: <strong className="text-emerald-600 text-xl">{report.overall_score}/10</strong></Label>
              <Slider
                value={[report.overall_score]}
                onValueChange={([v]) => setReport(p => ({ ...p, overall_score: v }))}
                max={10} min={0} step={0.5}
                className="py-2"
              />
            </div>
            <div>
              <Label className="mb-2 block">Recomendação</Label>
              <div className="flex gap-2">
                {[
                  { value: "recommended", label: "Recomendado", color: "bg-green-600" },
                  { value: "acceptable", label: "Aceitável", color: "bg-amber-500" },
                  { value: "not_recommended", label: "Não Recomendado", color: "bg-red-600" },
                ].map(opt => (
                  <Button
                    key={opt.value}
                    variant={report.recommendation === opt.value ? "default" : "outline"}
                    className={report.recommendation === opt.value ? opt.color : ''}
                    onClick={() => setReport(p => ({ ...p, recommendation: opt.value }))}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>Notas do Inspetor</Label>
              <Textarea
                value={report.inspector_notes}
                onChange={e => setReport(p => ({ ...p, inspector_notes: e.target.value }))}
                placeholder="Observações adicionais sobre o veículo..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={submitReport} disabled={saving} size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Submeter Relatório de Inspeção
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            Inspeções Carity
          </h1>
          <p className="text-muted-foreground">Inspeções de carros atribuídas à sua oficina</p>
        </div>
        <Badge variant="outline" className="text-emerald-600 border-emerald-200">
          <Euro className="h-3.5 w-3.5 mr-1" />
          €5,97 por inspeção
        </Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : inspections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Car className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold mb-2">Sem inspeções pendentes</h3>
            <p className="text-muted-foreground">Quando um carro for atribuído à sua oficina, aparecerá aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {inspections.map(inspection => {
            const listing = inspection.listing;
            const statusLabel = inspection.status === 'pending' ? 'Pendente' : inspection.status === 'in_progress' ? 'Em curso' : 'Concluída';
            const statusColor = inspection.status === 'pending' ? 'bg-amber-100 text-amber-800' : inspection.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
            
            return (
              <Card key={inspection.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4 items-center">
                    <div className="w-20 h-14 rounded bg-muted flex-shrink-0 overflow-hidden">
                      {listing?.photos?.[0] ? (
                        <img src={listing.photos[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full"><Car className="h-5 w-5 text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {listing?.make} {listing?.model} ({listing?.year})
                      </h3>
                      <p className="text-sm text-muted-foreground">{listing?.plate} · {listing?.mileage?.toLocaleString()} km</p>
                    </div>
                    <Badge className={statusColor}>{statusLabel}</Badge>
                    {inspection.status !== 'completed' && (
                      <Button onClick={() => startInspection(inspection)} className="bg-emerald-600 hover:bg-emerald-700">
                        <ClipboardCheck className="h-4 w-4 mr-1" />
                        {inspection.status === 'pending' ? 'Iniciar' : 'Continuar'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
