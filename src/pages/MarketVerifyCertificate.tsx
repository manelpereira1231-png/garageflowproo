import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, ShieldAlert, Loader2, CheckCircle, AlertTriangle, XCircle,
  MapPin, Clock, Hash, Car, Building2, FileCheck, ExternalLink,
} from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { formatLocalDate, getMarketLocale } from "@/lib/marketPrice";

const STATUS_LABEL: Record<string, { label: string; cls: string; Icon: any }> = {
  ok: { label: "Conforme", cls: "text-green-600", Icon: CheckCircle },
  problems: { label: "Anomalia", cls: "text-amber-500", Icon: AlertTriangle },
  critical: { label: "Crítico", cls: "text-red-600", Icon: XCircle },
};

const COMPONENTS = [
  { key: "engine_status", label: "Motor" },
  { key: "transmission_status", label: "Transmissão" },
  { key: "brakes_status", label: "Travões" },
  { key: "suspension_status", label: "Suspensão" },
  { key: "steering_status", label: "Direção" },
  { key: "tires_status", label: "Pneus" },
  { key: "electrical_status", label: "Sistema elétrico" },
];

export default function MarketVerifyCertificate() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data: result, error: err } = await supabase.rpc("verify_inspection_certificate" as any, { _token: token });
      if (err) {
        setError(err.message);
      } else if (result && (result as any).valid === false) {
        setError((result as any).error || "Certificado não encontrado");
      } else {
        setData(result);
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <Card className="max-w-md w-full border-red-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-6 w-6" />
              Certificado inválido
            </CardTitle>
            <CardDescription>{error || "Token de verificação não reconhecido"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { report, listing, shop, integrity_ok, computed_hash, stored_hash } = data;
  const score = report.overall_score;
  const scoreColor = score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-600";
  const scoreBg = score >= 80 ? "bg-green-50 border-green-200" : score >= 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  const recLabel: Record<string, string> = {
    recommended: "Aprovado — recomendado para compra",
    acceptable: "Aprovado com reservas",
    not_recommended: "Não recomendado para compra",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SEOHead
        title={`Verificação de Certificado · ${listing.make} ${listing.model}`}
        description="Certificado de inspeção técnica verificado pelo GarageFlow Market"
        realm="market"
      />

      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-500" />
            <span className="font-bold">GarageFlow Market</span>
          </Link>
          <Link to={`/market/car/${listing.id}`}>
            <Button variant="outline" size="sm" className="border-slate-700">
              Ver anúncio <ExternalLink className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 py-8">
        {/* Integrity status */}
        <Card className={integrity_ok ? "border-green-500 bg-green-950/30" : "border-red-500 bg-red-950/30"}>
          <CardContent className="p-6 flex items-center gap-4">
            {integrity_ok ? (
              <ShieldCheck className="h-10 w-10 text-green-500 flex-shrink-0" />
            ) : (
              <ShieldAlert className="h-10 w-10 text-red-500 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h2 className={`font-bold text-lg ${integrity_ok ? "text-green-400" : "text-red-400"}`}>
                {integrity_ok ? "Certificado verificado e íntegro" : "⚠️ Integridade comprometida"}
              </h2>
              <p className="text-sm text-slate-400">
                {integrity_ok
                  ? "O hash criptográfico bate certo com os dados originais selados pela oficina."
                  : "O hash armazenado não corresponde aos dados atuais. Não confie neste certificado."}
              </p>
            </div>
            <Badge variant={integrity_ok ? "default" : "destructive"}>
              {integrity_ok ? "VÁLIDO" : "INVÁLIDO"}
            </Badge>
          </CardContent>
        </Card>

        {/* Vehicle */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <Car className="h-5 w-5 text-amber-500" />
              Veículo certificado
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><span className="text-slate-400">Marca/Modelo:</span><div className="font-semibold">{listing.make} {listing.model}</div></div>
            <div><span className="text-slate-400">Ano:</span><div className="font-semibold">{listing.year}</div></div>
            <div><span className="text-slate-400">Matrícula:</span><div className="font-mono font-semibold">{listing.plate || "—"}</div></div>
            <div><span className="text-slate-400">VIN:</span><div className="font-mono text-xs break-all">{listing.vin || "n/d"}</div></div>
            <div><span className="text-slate-400">Km no anúncio:</span><div className="font-semibold">{listing.mileage?.toLocaleString(getMarketLocale()) || "—"}</div></div>
            <div><span className="text-slate-400">Km na inspeção:</span><div className="font-semibold text-amber-400">{report.mileage_at_inspection?.toLocaleString(getMarketLocale()) || "—"}</div></div>
          </CardContent>
        </Card>

        {/* Score */}
        <Card className={`${scoreBg} border-2`}>
          <CardContent className="p-6 text-center">
            <p className="text-xs text-slate-700 font-bold tracking-wider mb-2">CLASSIFICAÇÃO GERAL</p>
            <div className="flex items-baseline justify-center gap-2">
              <span className={`text-6xl font-bold ${scoreColor}`}>{(score / 10).toFixed(1)}</span>
              <span className="text-xl text-slate-600">/10</span>
            </div>
            <p className={`mt-2 font-semibold ${scoreColor}`}>{recLabel[report.recommendation] || report.recommendation}</p>
          </CardContent>
        </Card>

        {/* Workshop */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <Building2 className="h-5 w-5 text-amber-500" />
              Oficina certificadora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-slate-400">Nome:</span> <strong>{shop.name}</strong></div>
            <div><span className="text-slate-400">ID único:</span> <code className="text-xs">{shop.id?.slice(0, 8).toUpperCase()}</code></div>
            {shop.address && <div><span className="text-slate-400">Morada:</span> {shop.address}</div>}
            {(shop.city || shop.country) && <div><span className="text-slate-400">Local:</span> {[shop.city, shop.country].filter(Boolean).join(", ")}</div>}
            <div><span className="text-slate-400">Histórico:</span> <strong>{shop.total_inspections}</strong> inspeção(ões) certificada(s)</div>
            {report.technician_name && <div><span className="text-slate-400">Técnico responsável:</span> {report.technician_name}</div>}
          </CardContent>
        </Card>

        {/* Location & Timing */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <MapPin className="h-5 w-5 text-blue-400" />
              Auditoria física
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">📍 GPS:</span>
              {report.inspection_lat && report.inspection_lng ? (
                <div className="font-mono text-xs mt-1">
                  {Number(report.inspection_lat).toFixed(5)}, {Number(report.inspection_lng).toFixed(5)}
                  <a
                    href={`https://www.google.com/maps?q=${report.inspection_lat},${report.inspection_lng}`}
                    target="_blank" rel="noopener" className="ml-2 text-blue-400 underline"
                  >Ver no mapa</a>
                </div>
              ) : <span className="text-slate-500"> n/d</span>}
            </div>
            <div>
              <span className="text-slate-400">🌍 Local detetado:</span>
              <div className="mt-1">{[report.inspection_city, report.inspection_country].filter(Boolean).join(", ") || "—"}</div>
            </div>
            <div>
              <span className="text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Início:</span>
              <div className="mt-1">{report.started_at ? new Date(report.started_at).toLocaleString("pt-PT") : "—"}</div>
            </div>
            <div>
              <span className="text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Conclusão:</span>
              <div className="mt-1">{report.completed_at ? new Date(report.completed_at).toLocaleString("pt-PT") : "—"}</div>
            </div>
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <FileCheck className="h-5 w-5 text-amber-500" />
              Checklist mecânico
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {COMPONENTS.map(({ key, label }) => {
              const s = STATUS_LABEL[report[key]] || STATUS_LABEL.ok;
              const Icon = s.Icon;
              return (
                <div key={key} className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                  <span>{label}</span>
                  <span className={`flex items-center gap-1 font-semibold ${s.cls}`}>
                    <Icon className="h-4 w-4" /> {s.label}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Defects */}
        {Array.isArray(report.defects) && report.defects.length > 0 && (
          <Card className="bg-slate-900 border-amber-700/40">
            <CardHeader>
              <CardTitle className="text-slate-100">Anomalias registadas ({report.defects.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {report.defects.map((d: any, i: number) => (
                <div key={i} className="p-2 bg-slate-800/50 rounded">
                  <strong>{i + 1}.</strong> {d.description || d}
                  {d.severity && <Badge variant="outline" className="ml-2 text-xs">{d.severity}</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        {(["exterior_photos", "interior_photos", "engine_photos", "brakes_photos", "suspension_photos", "tire_photos", "damage_photos"] as const).map((sec) => {
          const arr: string[] = report[sec] || [];
          if (!arr.length) return null;
          const labels: Record<string, string> = {
            exterior_photos: "Exterior", interior_photos: "Interior", engine_photos: "Motor",
            brakes_photos: "Travões", suspension_photos: "Suspensão", tire_photos: "Pneus", damage_photos: "Danos",
          };
          return (
            <Card key={sec} className="bg-slate-900 border-slate-800">
              <CardHeader><CardTitle className="text-sm text-slate-200">📸 {labels[sec]} ({arr.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {arr.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener" className="block aspect-square rounded overflow-hidden">
                      <img src={url} alt={`${labels[sec]} ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Inspector notes */}
        {report.inspector_notes && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-slate-100">Notas do inspetor</CardTitle></CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">{report.inspector_notes}</CardContent>
          </Card>
        )}

        {/* Cryptographic integrity */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <Hash className="h-5 w-5 text-amber-500" />
              Integridade criptográfica
            </CardTitle>
            <CardDescription>SHA-256 calculado a partir de todos os dados auditáveis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs font-mono break-all">
            <div>
              <span className="text-slate-400 block">Hash armazenado:</span>
              <div className={integrity_ok ? "text-green-400" : "text-red-400"}>{stored_hash || "—"}</div>
            </div>
            <div>
              <span className="text-slate-400 block">Hash recalculado agora:</span>
              <div className={integrity_ok ? "text-green-400" : "text-red-400"}>{computed_hash}</div>
            </div>
            <p className="text-slate-400 mt-3 text-[11px]">
              Ref: {report.ref} · Selado em {report.locked_at ? new Date(report.locked_at).toLocaleString("pt-PT") : "—"}
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500 pt-4">
          Certificado emitido pela rede GarageFlow Market · Sistema não certificado pela AT (Portugal)
        </p>
      </div>
    </div>
  );
}
