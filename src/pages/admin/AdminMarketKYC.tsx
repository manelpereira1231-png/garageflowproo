import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, FileText, User } from "lucide-react";
import { toast } from "sonner";

export default function AdminMarketKYC() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [rejection, setRejection] = useState<Record<string, string>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, { doc?: string; selfie?: string }>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("carity_seller_profiles")
      .select("*")
      .eq("kyc_status", "submitted")
      .order("kyc_submitted_at", { ascending: true });
    setItems(data || []);

    // Generate signed URLs
    const urls: Record<string, { doc?: string; selfie?: string }> = {};
    for (const it of data || []) {
      const u: { doc?: string; selfie?: string } = {};
      if (it.document_url) {
        const { data: s } = await supabase.storage.from("kyc-documents").createSignedUrl(it.document_url, 600);
        u.doc = s?.signedUrl;
      }
      if (it.selfie_url) {
        const { data: s } = await supabase.storage.from("kyc-documents").createSignedUrl(it.selfie_url, 600);
        u.selfie = s?.signedUrl;
      }
      urls[it.id] = u;
    }
    setSignedUrls(urls);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decide = async (item: any, status: "approved" | "rejected") => {
    setActioning(item.id);
    try {
      const updates: any = {
        kyc_status: status,
        kyc_reviewed_at: new Date().toISOString(),
        verified: status === "approved",
      };
      if (status === "rejected") {
        updates.kyc_rejection_reason = rejection[item.id] || "Documentos insuficientes ou inválidos";
      }
      await supabase.from("carity_seller_profiles").update(updates).eq("id", item.id);
      toast.success(status === "approved" ? "Vendedor aprovado" : "Submissão recusada");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setActioning(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>;

  return (
    <div className="space-y-4 p-1">
      <div>
        <h1 className="text-2xl font-bold">Verificação de Identidade — KYC</h1>
        <p className="text-sm text-muted-foreground">{items.length} submissão{items.length !== 1 ? "ões" : ""} a aguardar revisão.</p>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />Sem submissões pendentes.</CardContent></Card>
      ) : items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> {item.name}
              <Badge variant="outline" className="text-[10px]">submetido {new Date(item.kyc_submitted_at).toLocaleDateString("pt-PT")}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Field label="NIF" value={item.nif} />
              <Field label="Telefone" value={item.phone} />
              <Field label="Tipo Doc" value={item.document_type === "cc" ? "Cartão Cidadão" : item.document_type === "passport" ? "Passaporte" : "Carta Condução"} />
              <Field label="Nº Doc" value={item.document_number} />
              <Field label="Morada" value={item.address || item.location} className="md:col-span-4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ImageSlot title="Documento" url={signedUrls[item.id]?.doc} />
              <ImageSlot title="Selfie com documento" url={signedUrls[item.id]?.selfie} />
            </div>

            <div className="border-t pt-3 space-y-2">
              <Textarea
                rows={2}
                placeholder="Motivo da recusa (caso recuse)..."
                value={rejection[item.id] || ""}
                onChange={(e) => setRejection((p) => ({ ...p, [item.id]: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => decide(item, "rejected")}
                  disabled={actioning === item.id}
                >
                  {actioning === item.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Recusar
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => decide(item, "approved")}
                  disabled={actioning === item.id}
                >
                  {actioning === item.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Aprovar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: any; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
      <p className="font-medium truncate">{value || "—"}</p>
    </div>
  );
}

function ImageSlot({ title, url }: { title: string; url?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {title}</p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={title} className="w-full h-48 object-cover rounded-md border hover:opacity-90 transition" />
        </a>
      ) : (
        <div className="w-full h-48 rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground">Sem imagem</div>
      )}
    </div>
  );
}
