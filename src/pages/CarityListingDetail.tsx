import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, ArrowLeft, Calendar, Gauge, Fuel, Car, CheckCircle, AlertTriangle, XCircle, Phone, Mail, MapPin, Star } from "lucide-react";

const STATUS_ICON: Record<string, any> = {
  ok: { icon: CheckCircle, color: "text-green-600", label: "OK" },
  problems: { icon: AlertTriangle, color: "text-amber-500", label: "Problemas" },
  critical: { icon: XCircle, color: "text-red-600", label: "Crítico" },
};

const CHECKLIST_LABELS: Record<string, string> = {
  engine_status: "Motor",
  transmission_status: "Transmissão",
  brakes_status: "Travões",
  suspension_status: "Suspensão",
  steering_status: "Direção",
  tires_status: "Pneus",
  electrical_status: "Sistema Elétrico",
};

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
  recommended: { label: "Recomendado", color: "bg-green-100 text-green-800" },
  acceptable: { label: "Aceitável", color: "bg-amber-100 text-amber-800" },
  not_recommended: { label: "Não Recomendado", color: "bg-red-100 text-red-800" },
};

export default function CarityListingDetail() {
  const { id } = useParams();
  const [listing, setListing] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(0);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    const { data: listingData } = await supabase
      .from("carity_listings")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .single();

    if (!listingData) { setLoading(false); return; }
    setListing({ ...listingData, photos: Array.isArray(listingData.photos) ? listingData.photos : [] });

    const [reportRes, sellerRes] = await Promise.all([
      supabase.from("carity_inspection_reports").select("*").eq("listing_id", id).single(),
      supabase.from("carity_seller_profiles").select("*").eq("user_id", listingData.seller_id).single(),
    ]);
    
    if (reportRes.data) {
      setReport({
        ...reportRes.data,
        defects: Array.isArray(reportRes.data.defects) ? reportRes.data.defects : [],
        exterior_photos: Array.isArray(reportRes.data.exterior_photos) ? reportRes.data.exterior_photos : [],
        interior_photos: Array.isArray(reportRes.data.interior_photos) ? reportRes.data.interior_photos : [],
        engine_photos: Array.isArray(reportRes.data.engine_photos) ? reportRes.data.engine_photos : [],
        damage_photos: Array.isArray(reportRes.data.damage_photos) ? reportRes.data.damage_photos : [],
      });
    }
    if (sellerRes.data) setSeller(sellerRes.data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Car className="h-16 w-16 text-muted-foreground/30" />
        <h2 className="text-xl font-semibold">Carro não encontrado</h2>
        <Link to="/carity"><Button>Voltar ao marketplace</Button></Link>
      </div>
    );
  }

  const allPhotos = [...listing.photos, ...(report?.exterior_photos || []), ...(report?.interior_photos || []), ...(report?.engine_photos || [])];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="bg-emerald-700 text-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
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

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Photos + Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo gallery */}
            <Card className="overflow-hidden">
              <div className="aspect-video bg-muted relative">
                {allPhotos[selectedPhoto] ? (
                  <img
                    src={allPhotos[selectedPhoto]}
                    alt={`${listing.make} ${listing.model}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Car className="h-16 w-16 text-muted-foreground/30" />
                  </div>
                )}
                <Badge className="absolute top-4 left-4 bg-emerald-600 text-white border-0">
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Inspecionado
                </Badge>
              </div>
              {allPhotos.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {allPhotos.map((photo: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setSelectedPhoto(i)}
                      className={`w-20 h-14 rounded overflow-hidden flex-shrink-0 border-2 ${i === selectedPhoto ? 'border-emerald-600' : 'border-transparent'}`}
                    >
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Car details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{listing.make} {listing.model}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Calendar className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-semibold">{listing.year}</p>
                    <p className="text-xs text-muted-foreground">Ano</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Gauge className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-semibold">{listing.mileage.toLocaleString()} km</p>
                    <p className="text-xs text-muted-foreground">Quilometragem</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Fuel className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-semibold">{listing.fuel}</p>
                    <p className="text-xs text-muted-foreground">Combustível</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <ShieldCheck className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                    <p className="font-semibold text-emerald-600">{report?.overall_score || '-'}/10</p>
                    <p className="text-xs text-muted-foreground">Classificação</p>
                  </div>
                </div>
                {listing.description && (
                  <>
                    <Separator className="my-4" />
                    <h3 className="font-semibold mb-2">Descrição</h3>
                    <p className="text-muted-foreground whitespace-pre-line">{listing.description}</p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Inspection Report */}
            {report && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      Relatório de Inspeção Carity
                    </CardTitle>
                    {report.recommendation && RECOMMENDATION_LABELS[report.recommendation] && (
                      <Badge className={RECOMMENDATION_LABELS[report.recommendation].color}>
                        {RECOMMENDATION_LABELS[report.recommendation].label}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Score */}
                  <div className="text-center py-4">
                    <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-6 py-3">
                      <Star className="h-8 w-8 text-emerald-600 fill-emerald-600" />
                      <span className="text-4xl font-bold text-emerald-700">{report.overall_score}</span>
                      <span className="text-xl text-muted-foreground">/10</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Classificação geral da oficina</p>
                  </div>

                  <Separator />

                  {/* Checklist */}
                  <div>
                    <h3 className="font-semibold mb-3">Checklist Mecânico</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
                        const status = report[key] || 'ok';
                        const config = STATUS_ICON[status] || STATUS_ICON.ok;
                        const Icon = config.icon;
                        return (
                          <div key={key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span className="font-medium">{label}</span>
                            <div className={`flex items-center gap-1.5 ${config.color}`}>
                              <Icon className="h-4 w-4" />
                              <span className="text-sm font-medium">{config.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Defects */}
                  {report.defects.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold mb-3">Problemas Identificados</h3>
                        <div className="space-y-2">
                          {report.defects.map((defect: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-sm">{defect.description || defect}</p>
                                {defect.severity && (
                                  <Badge variant="outline" className="mt-1 text-xs">
                                    {defect.severity === 'grave' ? '⚠️ Grave' : defect.severity === 'medio' ? '⚡ Médio' : '💡 Leve'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Damage photos */}
                  {report.damage_photos.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold mb-3">Fotos de Danos</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {report.damage_photos.map((photo: string, i: number) => (
                            <img key={i} src={photo} alt="Dano" className="rounded-lg w-full aspect-square object-cover" />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Inspector notes */}
                  {report.inspector_notes && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold mb-2">Notas do Inspetor</h3>
                        <p className="text-muted-foreground whitespace-pre-line">{report.inspector_notes}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Price + Seller + Contact */}
          <div className="space-y-6">
            <Card className="sticky top-4">
              <CardContent className="pt-6 space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-700">
                    €{listing.price.toLocaleString()}
                  </p>
                </div>
                
                <Separator />
                
                {seller && (
                  <div>
                    <h3 className="font-semibold mb-2 text-sm uppercase text-muted-foreground">Vendedor</h3>
                    <div className="space-y-2">
                      <p className="font-medium">{seller.name}</p>
                      {seller.location && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" /> {seller.location}
                        </p>
                      )}
                      {seller.phone && (
                        <a href={`tel:${seller.phone}`} className="flex items-center gap-2 text-sm text-emerald-600 hover:underline">
                          <Phone className="h-3.5 w-3.5" /> {seller.phone}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" size="lg">
                  Contactar vendedor
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  Este carro foi inspecionado e aprovado pelo sistema Carity
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
