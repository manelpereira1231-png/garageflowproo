import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { useShopMarketStatus } from "@/hooks/useShopMarketStatus";
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
import { ShieldCheck, Car, ClipboardCheck, Camera, CheckCircle, AlertTriangle, XCircle, Loader2, Euro, Plus, X, Bell, ThumbsUp, ThumbsDown, MessageCircle, CalendarCheck, Phone, User, Lock, Hash, FileCheck } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { useCountryPricing } from "@/hooks/useCountryPricing";

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
  photo_url?: string;
}

const SEVERITY_IMPACT: Record<string, { label: string; weight: number; color: string }> = {
  leve: { label: "Cosmético / Menor", weight: 1, color: "text-blue-600" },
  medio: { label: "Funcional — requer atenção", weight: 3, color: "text-amber-600" },
  grave: { label: "Segurança / Estrutural", weight: 5, color: "text-red-600" },
};

export default function CarityShopInspections() {
  const shopId = useActiveShopId();
  const { pricing, formatPrice } = useCountryPricing();
  const [tab, setTab] = useState("offers");
  const [offers, setOffers] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInspection, setActiveInspection] = useState<any>(null);
  const [activeListing, setActiveListing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Single source of truth for shop + Market enrollment status.
  // Subscribes to realtime updates on the shop row, so once enrolled this
  // page (and the ERP sidebar) NEVER re-render the "Ativar Market" screen
  // unless an admin explicitly deactivates the shop.
  const {
    ready: partnerChecked,
    isPartner,
    isActive,
    shop: shopData,
    refresh: refreshMarketStatus,
  } = useShopMarketStatus(shopId);

  const [enrolling, setEnrolling] = useState(false);


  // Step 2: Load inspections only if active partner
  const loadInspectionData = useCallback(async () => {
    if (!shopId || !isPartner || !isActive) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [offersRes, inspectionsRes] = await Promise.all([
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
    ]);

    setOffers((offersRes.data || []).map((o: any) => ({
      ...o,
      listing: o.carity_listings ? { ...o.carity_listings, photos: Array.isArray(o.carity_listings.photos) ? o.carity_listings.photos : [] } : null,
    })));

    const inspArr = (inspectionsRes.data || []).map((i: any) => ({
      ...i,
      listing: i.carity_listings ? { ...i.carity_listings, photos: Array.isArray(i.carity_listings.photos) ? i.carity_listings.photos : [] } : null,
    }));

    const sellerIds = [...new Set(inspArr.filter((i: any) => i.listing?.seller_id).map((i: any) => i.listing.seller_id))];
    let sellersMap: Record<string, any> = {};
    if (sellerIds.length > 0) {
      const { data: sellers } = await supabase
        .from("carity_seller_profiles")
        .select("*")
        .in("user_id", sellerIds);
      (sellers || []).forEach((s: any) => { sellersMap[s.user_id] = s; });
    }

    setInspections(inspArr.map((i: any) => ({
      ...i,
      seller: i.listing?.seller_id ? sellersMap[i.listing.seller_id] || null : null,
    })));

    setLoading(false);
  }, [shopId, isPartner, isActive]);

  useEffect(() => {
    if (partnerChecked) loadInspectionData();
  }, [partnerChecked, loadInspectionData]);

  // Realtime: listen for new inspection offers → auto-refresh + toast
  useEffect(() => {
    if (!shopId || !isPartner || !isActive) return;
    const channel = supabase
      .channel(`shop-offers-${shopId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "carity_inspection_offers",
          filter: `shop_id=eq.${shopId}`,
        },
        () => {
          toast.info("🚗 Nova inspeção disponível!", { description: "Verifique os pedidos pendentes." });
          loadInspectionData();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shopId, isPartner, isActive, loadInspectionData]);

  // Alias for callbacks that call loadData
  const loadData = loadInspectionData;

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

  // Schedule confirmation + WhatsApp to seller
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

      // Send WhatsApp to seller with schedule details
      const seller = scheduleDialog.seller;
      const listing = scheduleDialog.listing;
      if (seller?.phone) {
        const shopName = shopData?.name || "a oficina";
        const shopAddr = shopData?.address || "";
        const carLabel = `${listing?.make || ""} ${listing?.model || ""} (${listing?.plate || ""})`;
        const message = `Olá ${seller.name || ""}! 👋\n\nA inspeção do seu ${carLabel} foi agendada ✅\n\n📅 Data: ${schedDate}\n⏰ Hora: ${schedTime}\n🏪 Oficina: ${shopName}\n📍 Morada: ${shopAddr}\n\nPor favor traga o veículo na data e hora indicadas.\n\nObrigado!`;

        let phone = seller.phone.replace(/[^0-9+]/g, '');
        if (phone.startsWith('00')) phone = '+' + phone.slice(2);
        if (!phone.startsWith('+') && !phone.startsWith('351')) phone = '351' + phone;
        phone = phone.replace('+', '');

        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, "_blank", "noopener");
      }

      toast.success("Inspeção agendada! Mensagem WhatsApp aberta para o vendedor.");
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

  const captureGeolocation = async () => {
    if (!navigator.geolocation) return;
    setGeo(p => ({ ...p, capturing: true }));
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
      });
      const { latitude, longitude } = pos.coords;
      let city = ""; let country = "";
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=pt`);
        const j = await r.json();
        city = j.address?.city || j.address?.town || j.address?.village || j.address?.municipality || "";
        country = j.address?.country || "";
      } catch {}
      setGeo({ lat: latitude, lng: longitude, city, country, capturing: false });
    } catch (err: any) {
      toast.error("Não foi possível obter a localização GPS — necessária para certificar a inspeção.");
      setGeo(p => ({ ...p, capturing: false }));
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
      // If report is locked, show read-only
      if ((existing as any).is_locked) {
        setReportLocked(true);
        toast.info("Este relatório está bloqueado e não pode ser editado.");
      } else {
        setReportLocked(false);
      }
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
      setTechnicianName((existing as any).technician_name || "");
      setDefects(Array.isArray(existing.defects) ? (existing.defects as unknown as Defect[]) : []);
      setPhotoSections({
        exterior_photos: Array.isArray(existing.exterior_photos) ? existing.exterior_photos as string[] : [],
        interior_photos: Array.isArray(existing.interior_photos) ? existing.interior_photos as string[] : [],
        engine_photos: Array.isArray(existing.engine_photos) ? existing.engine_photos as string[] : [],
        brakes_photos: Array.isArray((existing as any).brakes_photos) ? (existing as any).brakes_photos as string[] : [],
        suspension_photos: Array.isArray((existing as any).suspension_photos) ? (existing as any).suspension_photos as string[] : [],
        tire_photos: Array.isArray(existing.tire_photos) ? existing.tire_photos as string[] : [],
        damage_photos: Array.isArray(existing.damage_photos) ? existing.damage_photos as string[] : [],
      });
      setMileageAtInspection(((existing as any).mileage_at_inspection ?? inspection.listing?.mileage ?? "").toString());
      setStartedAt((existing as any).started_at || null);
      if ((existing as any).inspection_lat) {
        setGeo({
          lat: (existing as any).inspection_lat,
          lng: (existing as any).inspection_lng,
          city: (existing as any).inspection_city || "",
          country: (existing as any).inspection_country || "",
          capturing: false,
        });
      }
    } else {
      setReportLocked(false);
      setReport({ engine_status: "ok", transmission_status: "ok", brakes_status: "ok", suspension_status: "ok", steering_status: "ok", tires_status: "ok", electrical_status: "ok", overall_score: 7, recommendation: "recommended", inspector_notes: "" });
      setTechnicianName("");
      setDefects([]);
      setPhotoSections({ exterior_photos: [], interior_photos: [], engine_photos: [], brakes_photos: [], suspension_photos: [], tire_photos: [], damage_photos: [] });
      setMileageAtInspection((inspection.listing?.mileage ?? "").toString());
      const nowIso = new Date().toISOString();
      setStartedAt(nowIso);
      setGeo({ lat: null, lng: null, city: "", country: "", capturing: false });
      // Auto-capture GPS for new inspections
      captureGeolocation();
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

  // Weighted auto-score calculation (0-100)
  const calculateAutoScore = (r: typeof report): number => {
    const statusScore: Record<string, number> = { ok: 100, problems: 50, critical: 0 };
    const weights = {
      engine_status: 0.30,
      brakes_status: 0.20,
      suspension_status: 0.20,
      tires_status: 0.15,
      electrical_status: 0.15,
    };
    let score = 0;
    for (const [key, weight] of Object.entries(weights)) {
      score += (statusScore[r[key as keyof typeof r] as string] ?? 50) * weight;
    }
    return Math.round(score);
  };

  // Auto-update score when component statuses change
  useEffect(() => {
    if (!activeInspection) return;
    const auto = calculateAutoScore(report);
    setReport(p => ({ ...p, overall_score: auto }));
  }, [report.engine_status, report.brakes_status, report.suspension_status, report.tires_status, report.electrical_status]);

  const submitReport = async () => {
    if (!activeInspection || !shopId) return;
    if (reportLocked) { toast.error("Este relatório está bloqueado e não pode ser alterado."); return; }

    // Validate technician name
    if (!technicianName.trim()) { toast.error("Identifique o técnico responsável pela inspeção."); return; }

    // Validate defect descriptions
    const validDefects = defects.filter(d => d.description.trim());
    const graveDefects = validDefects.filter(d => d.severity === 'grave');
    
    // If grave defects exist, require photo evidence
    if (graveDefects.length > 0 && photoSections.damage_photos.length === 0) {
      toast.error("Defeitos graves identificados — é obrigatório carregar fotos de danos como prova.");
      return;
    }

    // Enforce minimum 6 photos total
    const totalPhotos = Object.values(photoSections).reduce((sum, arr) => sum + arr.length, 0);
    if (totalPhotos < 6) { toast.error("Carregue pelo menos 6 fotos no total (exterior, interior, motor, etc.)"); return; }
    if (photoSections.exterior_photos.length < 2) { toast.error("Carregue pelo menos 2 fotos do exterior"); return; }
    if (photoSections.interior_photos.length < 2) { toast.error("Carregue pelo menos 2 fotos do interior"); return; }
    if (photoSections.engine_photos.length < 1) { toast.error("Carregue pelo menos 1 foto do motor"); return; }
    if (photoSections.brakes_photos.length < 1) { toast.error("Carregue pelo menos 1 foto dos travões — prova obrigatória"); return; }
    if (photoSections.suspension_photos.length < 1) { toast.error("Carregue pelo menos 1 foto da suspensão — prova obrigatória"); return; }
    if (photoSections.tire_photos.length < 1) { toast.error("Carregue pelo menos 1 foto dos pneus — prova obrigatória"); return; }

    // Validate mileage at inspection
    const mileageNum = parseInt(mileageAtInspection, 10);
    if (!mileageNum || mileageNum < 0) { toast.error("Indique a quilometragem registada no momento da inspeção."); return; }

    // Validate GPS location captured
    if (geo.lat === null || geo.lng === null) {
      toast.error("Localização GPS obrigatória — clique em 'Capturar localização' antes de submeter.");
      return;
    }

    const autoScore = calculateAutoScore(report);

    // Apply defect penalty
    const defectPenalty = validDefects.reduce((sum, d) => sum + (SEVERITY_IMPACT[d.severity]?.weight || 0) * 3, 0);
    const finalScore = Math.max(0, Math.min(100, autoScore - defectPenalty));

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;

      const { data: existing } = await supabase
        .from("carity_inspection_reports").select("id, is_locked").eq("inspection_id", activeInspection.id).maybeSingle();

      // Block if already locked
      if (existing && (existing as any).is_locked) {
        toast.error("Este relatório já foi submetido e bloqueado permanentemente.");
        setSaving(false);
        return;
      }

      // Auto-determine recommendation from score
      const autoRecommendation = finalScore >= 80 ? "recommended" : finalScore >= 60 ? "acceptable" : "not_recommended";

      const completedAtIso = new Date().toISOString();
      const reportData: any = {
        inspection_id: activeInspection.id, listing_id: activeInspection.listing_id, shop_id: shopId,
        ...report,
        overall_score: finalScore,
        recommendation: autoRecommendation,
        defects: validDefects as unknown as any,
        exterior_photos: photoSections.exterior_photos as unknown as any,
        interior_photos: photoSections.interior_photos as unknown as any,
        engine_photos: photoSections.engine_photos as unknown as any,
        brakes_photos: photoSections.brakes_photos as unknown as any,
        suspension_photos: photoSections.suspension_photos as unknown as any,
        tire_photos: photoSections.tire_photos as unknown as any,
        damage_photos: photoSections.damage_photos as unknown as any,
        started_at: startedAt || completedAtIso,
        completed_at: completedAtIso,
        inspection_lat: geo.lat,
        inspection_lng: geo.lng,
        inspection_city: geo.city || null,
        inspection_country: geo.country || null,
        mileage_at_inspection: mileageNum,
        technician_name: technicianName.trim(),
        submitted_by_user_id: currentUserId,
        is_locked: true,
        locked_at: completedAtIso,
      };

      let reportId: string;
      if (existing) {
        await supabase.from("carity_inspection_reports").update(reportData).eq("id", existing.id);
        reportId = existing.id;
      } else {
        const { data: newReport } = await supabase.from("carity_inspection_reports").insert(reportData).select("id").single();
        reportId = newReport?.id || "";
      }

      // Generate cryptographic hash for integrity
      if (reportId) {
        const { data: hashResult } = await supabase.rpc("generate_report_hash", { _report_id: reportId });
        if (hashResult) {
          await supabase.from("carity_inspection_reports")
            .update({ report_hash: hashResult } as any)
            .eq("id", reportId);
        }
      }

      // === COHERENCE VALIDATION ===
      if (reportId) {
        const { data: coherenceResult } = await supabase.rpc("validate_inspection_coherence", {
          _listing_id: activeInspection.listing_id,
          _report_id: reportId,
        });
        
        const coherence = coherenceResult as any;
        if (coherence && coherence.warnings && coherence.warning_count > 0) {
          const warnings = coherence.warnings as any[];
          const criticalWarnings = warnings.filter((w: any) => w.severity === 'critical' || w.severity === 'high');
          
          if (criticalWarnings.length > 0) {
            toast.warning(
              `⚠️ Validação de coerência: ${coherence.warning_count} aviso(s) detetado(s). Score de coerência: ${coherence.coherence_score}/100`,
              { duration: 8000 }
            );
            criticalWarnings.forEach((w: any) => {
              toast.warning(w.message, { duration: 6000 });
            });
          }

          // Log coherence issues to audit
          await supabase.from("audit_logs").insert({
            action: "inspection_coherence_check",
            entity_type: "carity_inspection_reports",
            entity_id: reportId,
            details: coherence,
          });

          // Block publication if coherence fails critically
          if (!coherence.can_publish) {
            await supabase.from("carity_inspections")
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq("id", activeInspection.id);
            await supabase.from("carity_listings")
              .update({ status: 'rejected' })
              .eq("id", activeInspection.listing_id);
            toast.error(`Relatório rejeitado pela validação de coerência (score: ${coherence.coherence_score}/100). O relatório está bloqueado.`, { duration: 10000 });
            setActiveInspection(null);
            loadData();
            return;
          }
        }
      }

      await supabase.from("carity_inspections")
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq("id", activeInspection.id);

      // Auto-publish or reject based on score
      if (finalScore >= 60) {
        await supabase.from("carity_listings")
          .update({ status: 'published', published_at: new Date().toISOString() })
          .eq("id", activeInspection.listing_id);
        toast.success(`✅ Relatório submetido e BLOQUEADO permanentemente. Score: ${finalScore}/100 — Carro publicado no Market`);
      } else {
        await supabase.from("carity_listings")
          .update({ status: 'rejected' })
          .eq("id", activeInspection.listing_id);
        toast.warning(`Relatório submetido e BLOQUEADO. Score: ${finalScore}/100 — Carro rejeitado (mínimo 60) ❌`);
      }

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
    const defectPenalty = defects.filter(d => d.description.trim()).reduce((sum, d) => sum + (SEVERITY_IMPACT[d.severity]?.weight || 0) * 3, 0);
    const displayScore = Math.max(0, Math.min(100, report.overall_score - defectPenalty));
    const displayRecommendation = displayScore >= 80 ? "✅ Aprovado" : displayScore >= 60 ? "⚠️ Aprovado com reservas" : "❌ Reprovado";

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

        {/* LOCKED BANNER */}
        {reportLocked && (
          <Card className="border-red-300 bg-red-50 dark:bg-red-900/10">
            <CardContent className="p-4 flex items-center gap-3">
              <Lock className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-300">🔒 Relatório BLOQUEADO permanentemente</p>
                <p className="text-sm text-red-600 dark:text-red-400">Este relatório foi submetido e não pode ser editado, substituído ou eliminado. Qualquer alteração requer auditoria da plataforma.</p>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Technician identification */}
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-amber-500" />
              Identificação do Técnico Responsável
            </CardTitle>
            <CardDescription>O nome do técnico ficará vinculado permanentemente a este relatório</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Nome completo do técnico *</Label>
              <Input
                value={technicianName}
                onChange={e => setTechnicianName(e.target.value)}
                placeholder="Ex: João Silva"
                disabled={reportLocked}
                className={reportLocked ? "opacity-60" : ""}
              />
              {!technicianName.trim() && !reportLocked && (
                <p className="text-xs text-red-500">Obrigatório — o relatório não pode ser submetido sem identificação</p>
              )}
            </div>
          </CardContent>
        </Card>

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

        {/* Identidade da oficina + auditoria */}
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-900/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Inspeção certificada por
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">Oficina:</span>{" "}
                <strong>{shopData?.name || "—"}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">ID oficina:</span>{" "}
                <code className="text-xs">{shopId?.slice(0, 8).toUpperCase()}</code>
              </div>
              {shopData?.nif && (
                <div>
                  <span className="text-muted-foreground">NIF:</span> <strong>{shopData.nif}</strong>
                </div>
              )}
              {shopData?.address && (
                <div className="md:col-span-2">
                  <span className="text-muted-foreground">Morada:</span> {shopData.address}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Localização GPS + Km no momento */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              📍 Auditoria física da inspeção
            </CardTitle>
            <CardDescription>
              Estes dados ficam imutáveis no certificado e provam que a inspeção foi feita fisicamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Quilometragem registada agora *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={mileageAtInspection}
                  onChange={(e) => setMileageAtInspection(e.target.value)}
                  placeholder="Ex: 145000"
                  disabled={reportLocked}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Km do anúncio: {activeListing.mileage?.toLocaleString() || "—"}
                </p>
              </div>
              <div>
                <Label>Localização GPS *</Label>
                {geo.lat && geo.lng ? (
                  <div className="text-sm space-y-1 mt-1">
                    <p className="font-mono text-xs">
                      {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
                    </p>
                    {(geo.city || geo.country) && (
                      <p className="text-muted-foreground">
                        {[geo.city, geo.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {!reportLocked && (
                      <Button size="sm" variant="outline" onClick={captureGeolocation} disabled={geo.capturing}>
                        {geo.capturing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Recapturar"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={captureGeolocation}
                    disabled={geo.capturing || reportLocked}
                    className="mt-1"
                  >
                    {geo.capturing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "📡"}
                    Capturar localização
                  </Button>
                )}
              </div>
            </div>
            {startedAt && (
              <p className="text-xs text-muted-foreground">
                ⏱️ Inspeção iniciada em {new Date(startedAt).toLocaleString("pt-PT")} (timestamp imutável)
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Checklist Mecânico (Sistema Fechado)</CardTitle>
            <CardDescription>Avalie cada componente — a classificação final é calculada automaticamente</CardDescription>
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
                        onClick={() => !reportLocked && setReport(p => ({ ...p, [key]: opt.value }))}
                        disabled={reportLocked}>
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
            <CardTitle className="text-lg">📸 Prova Evidencial Obrigatória</CardTitle>
            <CardDescription>Fotos estruturadas — cada declaração deve ter prova visual associada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              { key: "exterior_photos", label: "Exterior — mín. 2 fotos (frente, trás, laterais)", required: true },
              { key: "interior_photos", label: "Interior — mín. 2 fotos (painel, bancos, quilometragem)", required: true },
              { key: "engine_photos", label: "Motor — mín. 1 foto do compartimento", required: true },
              { key: "brakes_photos", label: "Travões — mín. 1 foto (discos / pastilhas)", required: true },
              { key: "suspension_photos", label: "Suspensão — mín. 1 foto (amortecedores / triangulações)", required: true },
              { key: "tire_photos", label: "Pneus — mín. 1 foto (estado do piso)", required: true },
              { key: "damage_photos", label: "Danos encontrados (obrigatório se defeitos graves)", required: false },
            ].map(section => (
              <div key={section.key}>
                <Label className="mb-2 block">
                  {section.label} {section.required && <span className="text-red-500">*</span>}
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {photoSections[section.key].map((photo, i) => (
                    <div key={i} className="w-20 h-20 rounded overflow-hidden relative group">
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                      {!reportLocked && (
                        <button onClick={() => setPhotoSections(prev => ({ ...prev, [section.key]: prev[section.key].filter((_, idx) => idx !== i) }))}
                          className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {!reportLocked && (
                    <label className="w-20 h-20 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-muted/50">
                      {uploading === section.key ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                      <input type="file" className="hidden" accept="image/*" multiple onChange={e => handlePhotoUpload(section.key, e)} />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Defeitos / Problemas Identificados</CardTitle>
            <CardDescription>Cada defeito tem impacto direto no score — defeitos graves exigem prova fotográfica</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {defects.map((defect, i) => (
              <div key={i} className="p-3 bg-muted/30 rounded-lg space-y-2">
                <div className="flex gap-2 items-start">
                  <Input value={defect.description} onChange={e => { const u = [...defects]; u[i].description = e.target.value; setDefects(u); }} placeholder="Descreva o problema..." className="flex-1" disabled={reportLocked} />
                  <Select value={defect.severity} onValueChange={v => { const u = [...defects]; u[i].severity = v as Defect["severity"]; setDefects(u); }} disabled={reportLocked}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leve">💡 Leve</SelectItem>
                      <SelectItem value="medio">⚡ Médio</SelectItem>
                      <SelectItem value="grave">⚠️ Grave</SelectItem>
                    </SelectContent>
                  </Select>
                  {!reportLocked && <Button variant="ghost" size="icon" onClick={() => removeDefect(i)}><X className="h-4 w-4" /></Button>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={SEVERITY_IMPACT[defect.severity]?.color || ""}>
                    {SEVERITY_IMPACT[defect.severity]?.label} — Penalização: -{(SEVERITY_IMPACT[defect.severity]?.weight || 0) * 3} pts
                  </span>
                </div>
              </div>
            ))}
            {!reportLocked && (
              <Button variant="outline" size="sm" onClick={addDefect}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar defeito</Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Motor de Decisão Automático
            </CardTitle>
            <CardDescription>A classificação é gerada pelo sistema — a oficina NÃO pode alterar o resultado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-4">
              <div className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 ${
                displayScore >= 80 ? 'bg-green-50 dark:bg-green-900/20' :
                displayScore >= 60 ? 'bg-amber-50 dark:bg-amber-900/20' :
                'bg-red-50 dark:bg-red-900/20'
              }`}>
                <span className={`text-4xl font-bold ${
                  displayScore >= 80 ? 'text-green-700 dark:text-green-400' :
                  displayScore >= 60 ? 'text-amber-700 dark:text-amber-400' :
                  'text-red-700 dark:text-red-400'
                }`}>{displayScore}</span>
                <span className="text-xl text-muted-foreground">/100</span>
              </div>
              <p className={`text-lg font-bold mt-2 ${
                displayScore >= 80 ? 'text-green-700 dark:text-green-400' :
                displayScore >= 60 ? 'text-amber-700 dark:text-amber-400' :
                'text-red-700 dark:text-red-400'
              }`}>{displayRecommendation}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Motor 30% · Travões 20% · Suspensão 20% · Pneus 15% · Eletrónica 15%
                {defectPenalty > 0 && <span className="text-red-500 ml-1">· Penalização defeitos: -{defectPenalty} pts</span>}
              </p>
            </div>

            {/* Consequences */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold">⚙️ Consequências automáticas:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>✅ Score ≥ 80 → <strong>Aprovado</strong> — publicação automática</li>
                <li>⚠️ Score 60-79 → <strong>Aprovado com reservas</strong> — publicação com aviso</li>
                <li>❌ Score &lt; 60 → <strong>Reprovado</strong> — veículo NÃO é publicado</li>
                <li>🔒 Após submissão → relatório bloqueado permanentemente</li>
                <li>🔐 Hash SHA-256 gerado para garantir integridade</li>
              </ul>
            </div>

            <div>
              <Label>Notas do Inspetor</Label>
              <Textarea value={report.inspector_notes} onChange={e => setReport(p => ({ ...p, inspector_notes: e.target.value }))} placeholder="Observações adicionais..." rows={4} disabled={reportLocked} />
            </div>
          </CardContent>
        </Card>

        {!reportLocked ? (
          <Button onClick={submitReport} disabled={saving} size="lg" className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            Submeter e BLOQUEAR Relatório Permanentemente
          </Button>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Lock className="h-4 w-4" /> Relatório bloqueado — sem alterações possíveis
            </p>
          </div>
        )}
      </div>
    );
  }

  // --- ENROLLMENT HANDLER ---
  const handleEnroll = async () => {
    if (!shopId || !shopData) return;

    if (!shopData.name?.trim()) { toast.error("A oficina precisa de ter um nome configurado nas Definições."); return; }
    if (!shopData.phone?.trim()) { toast.error("Adicione um número de telefone nas Definições da oficina."); return; }
    if (!shopData.address?.trim()) { toast.error("Adicione a morada completa nas Definições da oficina."); return; }

    setEnrolling(true);
    try {
      // Uses SECURITY DEFINER RPC: validates fields, flips partner flags
      // and auto-creates the shop wallet so payouts work immediately.
      const { error } = await supabase.rpc("enroll_shop_in_market" as any, { _shop_id: shopId });
      if (error) {
        const msg = error.message || "";
        if (msg.includes("missing_name")) throw new Error("Configure o nome da oficina nas Definições.");
        if (msg.includes("missing_phone")) throw new Error("Configure o telefone nas Definições.");
        if (msg.includes("missing_address")) throw new Error("Configure a morada nas Definições.");
        if (msg.includes("not_authorized")) throw new Error("Sem permissão para inscrever esta oficina.");
        throw error;
      }

      setIsPartner(true);
      setIsActive(true);
      toast.success("Oficina inscrita no GarageFlow Market! 🎉 Carteira ativada — já pode receber pedidos.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao inscrever oficina");
    } finally {
      setEnrolling(false);
    }
  };

  // --- NO ACTIVE SHOP STATE ---
  if (partnerChecked && !shopId) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-4 pt-12">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
          <ShieldCheck className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold">GarageFlow Market</h1>
        <p className="text-muted-foreground">
          Para receber pedidos de inspeção e ganhar dinheiro extra, primeiro tens de criar/selecionar uma oficina nas Definições.
        </p>
        <Button asChild size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
          <a href="/settings">Ir para Definições</a>
        </Button>
      </div>
    );
  }

  // --- ENROLLMENT SCREEN ---
  if (isPartner === false) {
    const hasName = !!shopData?.name?.trim();
    const hasPhone = !!shopData?.phone?.trim();
    const hasAddress = !!shopData?.address?.trim();
    const allReady = hasName && hasPhone && hasAddress;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center pt-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold">GarageFlow Market</h1>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Junte-se à rede de oficinas certificadas e ganhe por cada inspeção realizada a veículos do marketplace.
          </p>
        </div>

        {/* Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted/50">
                <ClipboardCheck className="h-6 w-6 mx-auto text-amber-500 mb-2" />
                <h3 className="font-semibold text-sm">Receba pedidos</h3>
                <p className="text-xs text-muted-foreground mt-1">Vendedores pedem inspeção e o sistema atribui à oficina mais próxima</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <Camera className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                <h3 className="font-semibold text-sm">Faça a inspeção</h3>
                <p className="text-xs text-muted-foreground mt-1">Checklist mecânico, fotos reais e relatório técnico completo</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <Euro className="h-6 w-6 mx-auto text-green-500 mb-2" />
                <h3 className="font-semibold text-sm">Receba por inspeção</h3>
                <p className="text-xs text-muted-foreground mt-1">70% do valor da inspeção é creditado à sua oficina automaticamente</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue info */}
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-900/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Euro className="h-5 w-5 text-amber-600" />
              <div>
                 <p className="font-semibold text-sm">Ganhos por inspeção: <span className="text-amber-600">{formatPrice(pricing.inspection_shop_share)}</span></p>
                 <p className="text-xs text-muted-foreground">O vendedor paga {formatPrice(pricing.inspection_price)} — {formatPrice(pricing.inspection_shop_share)} fica para a oficina, {formatPrice(pricing.inspection_platform_share)} para a plataforma</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requirements checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Requisitos para inscrição</CardTitle>
            <CardDescription>A sua oficina precisa de ter os dados completos nas Definições</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`flex items-center gap-3 p-3 rounded-lg ${hasName ? "bg-green-50 dark:bg-green-900/10" : "bg-red-50 dark:bg-red-900/10"}`}>
              {hasName ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />}
              <div className="flex-1">
                <p className="text-sm font-medium">Nome da oficina</p>
                <p className="text-xs text-muted-foreground">{hasName ? shopData?.name : "Não configurado — vá às Definições"}</p>
              </div>
            </div>
            <div className={`flex items-center gap-3 p-3 rounded-lg ${hasPhone ? "bg-green-50 dark:bg-green-900/10" : "bg-red-50 dark:bg-red-900/10"}`}>
              {hasPhone ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />}
              <div className="flex-1">
                <p className="text-sm font-medium">Telefone</p>
                <p className="text-xs text-muted-foreground">{hasPhone ? shopData?.phone : "Não configurado — vá às Definições"}</p>
              </div>
            </div>
            <div className={`flex items-center gap-3 p-3 rounded-lg ${hasAddress ? "bg-green-50 dark:bg-green-900/10" : "bg-red-50 dark:bg-red-900/10"}`}>
              {hasAddress ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />}
              <div className="flex-1">
                <p className="text-sm font-medium">Morada completa</p>
                <p className="text-xs text-muted-foreground">{hasAddress ? shopData?.address : "Não configurada — vá às Definições"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleEnroll}
          disabled={!allReady || enrolling}
          size="lg"
          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-base"
        >
          {enrolling ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ShieldCheck className="h-5 w-5 mr-2" />}
          {allReady ? "Inscrever oficina no GarageFlow Market" : "Complete os requisitos acima para se inscrever"}
        </Button>

        {!allReady && (
          <p className="text-center text-sm text-muted-foreground">
            Aceda às <a href="/settings" className="text-primary underline font-medium">Definições</a> para completar os dados em falta.
          </p>
        )}
      </div>
    );
  }

  // --- PENDING APPROVAL SCREEN ---
  if (isPartner && !isActive) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 pt-12">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
          <ShieldCheck className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold">Inscrição em análise</h1>
        <p className="text-muted-foreground">
          A sua candidatura ao GarageFlow Market está a ser analisada. Receberá uma notificação assim que for aprovada.
        </p>
        <Card className="border-amber-200">
          <CardContent className="p-4 text-left space-y-2">
            <p className="text-sm"><strong>Oficina:</strong> {shopData?.name}</p>
            <p className="text-sm"><strong>Morada:</strong> {shopData?.address}</p>
            <p className="text-sm"><strong>Telefone:</strong> {shopData?.phone}</p>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">Se precisar de ajuda, contacte o suporte.</p>
      </div>
    );
  }

  // --- LOADING STATE ---
  if (!partnerChecked || (isPartner && isActive && loading)) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
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
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800">
            <Euro className="h-3.5 w-3.5 mr-1" />
            €{totalEarnings.toFixed(2)} ganhos
          </Badge>
          <Button asChild variant="outline" size="sm">
            <a href="/market/payouts">Como recebo?</a>
          </Button>
        </div>
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
