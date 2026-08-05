import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldCheck, ShieldAlert, FileCheck2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Admin → SAF-T / Certificação AT.
 *
 * Painel único onde vive TODA a configuração legal do SAF-T.
 * O código de geração do XML não tem valores legais hardcoded: lê daqui.
 * Quando a certificação for obtida, basta preencher e ativar — sem deploy.
 */

type Cert = {
  id: string;
  is_certified: boolean;
  software_certificate_number: string | null;
  product_id: string;
  product_version: string;
  producer_company_name: string | null;
  producer_tax_id: string | null;
  saft_version: string;
  tax_accounting_basis: string;
  signing_enabled: boolean;
  signing_key_secret_name: string;
  signing_key_version: string;
  header_comment_override: string | null;
};

type Series = {
  id: string;
  shop_id: string;
  doc_type: string;
  series_code: string;
  at_validation_code: string | null;
  initial_sequence: number;
  is_active: boolean;
};

const DOC_TYPES = ["FT", "FR", "NC", "ND", "ORC"];

export default function AdminSaftCertification() {
  const [cert, setCert] = useState<Cert | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [shopId, setShopId] = useState<string>("");
  const [series, setSeries] = useState<Series[]>([]);
  const [newSeries, setNewSeries] = useState({ doc_type: "FT", series_code: "", at_validation_code: "", initial_sequence: "1" });

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: s }] = await Promise.all([
        supabase.from("saft_certification_settings" as any).select("*").limit(1).maybeSingle(),
        supabase.from("shops").select("id,name").order("name").limit(500),
      ]);
      if (c) setCert(c as unknown as Cert);
      setShops((s as any[]) || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!shopId) { setSeries([]); return; }
    void (async () => {
      const { data } = await supabase
        .from("document_series" as any)
        .select("*").eq("shop_id", shopId).order("doc_type");
      setSeries((data as unknown as Series[]) || []);
    })();
  }, [shopId]);

  const patch = (k: keyof Cert, v: unknown) => setCert((p) => (p ? { ...p, [k]: v } as Cert : p));

  const save = async () => {
    if (!cert) return;
    setSaving(true);
    const { error } = await supabase
      .from("saft_certification_settings" as any)
      .update({
        is_certified: cert.is_certified,
        software_certificate_number: cert.software_certificate_number || null,
        product_id: cert.product_id,
        product_version: cert.product_version,
        producer_company_name: cert.producer_company_name || null,
        producer_tax_id: cert.producer_tax_id || null,
        saft_version: cert.saft_version,
        tax_accounting_basis: cert.tax_accounting_basis,
        signing_enabled: cert.signing_enabled,
        signing_key_secret_name: cert.signing_key_secret_name,
        signing_key_version: cert.signing_key_version,
        header_comment_override: cert.header_comment_override || null,
      })
      .eq("id", cert.id);
    setSaving(false);
    if (error) toast.error("Sem permissão ou erro ao guardar.");
    else toast.success("Configuração de certificação guardada.");
  };

  const addSeries = async () => {
    if (!shopId || !newSeries.series_code.trim()) {
      toast.error("Escolha uma oficina e indique o código da série.");
      return;
    }
    const { data, error } = await supabase.from("document_series" as any).insert({
      shop_id: shopId,
      doc_type: newSeries.doc_type,
      series_code: newSeries.series_code.trim(),
      at_validation_code: newSeries.at_validation_code.trim() || null,
      initial_sequence: Number(newSeries.initial_sequence) || 1,
    }).select().maybeSingle();
    if (error) { toast.error(error.message); return; }
    setSeries((p) => [...p, data as unknown as Series]);
    setNewSeries({ doc_type: "FT", series_code: "", at_validation_code: "", initial_sequence: "1" });
    toast.success("Série criada.");
  };

  const updateSeries = async (id: string, patchObj: Partial<Series>) => {
    const { error } = await supabase.from("document_series" as any).update(patchObj).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSeries((p) => p.map((s) => (s.id === id ? { ...s, ...patchObj } : s)));
  };

  const removeSeries = async (id: string) => {
    const { error } = await supabase.from("document_series" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSeries((p) => p.filter((s) => s.id !== id));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!cert) {
    return <div className="p-6 text-sm text-muted-foreground">Sem acesso à configuração de certificação (apenas Super Admin).</div>;
  }

  const ready = cert.is_certified && !!cert.software_certificate_number;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <FileCheck2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">SAF-T · Certificação AT</h1>
        {ready ? (
          <Badge className="gap-1"><ShieldCheck className="h-3 w-3" /> Certificado</Badge>
        ) : (
          <Badge variant="outline" className="gap-1"><ShieldAlert className="h-3 w-3" /> Não certificado</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Certificação do software</CardTitle>
          <CardDescription>
            Enquanto o número de certificado não for atribuído pela AT, o SAF-T é gerado com
            <code className="mx-1">0</code> e mantém o aviso legal no cabeçalho. Nada é inventado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <Label>Software certificado pela AT</Label>
              <p className="text-xs text-muted-foreground">Ativar apenas após certificação efetiva.</p>
            </div>
            <Switch checked={cert.is_certified} onCheckedChange={(v) => patch("is_certified", v)} />
          </div>
          <div>
            <Label>Nº de certificado (SoftwareCertificateNumber)</Label>
            <Input value={cert.software_certificate_number ?? ""} placeholder="Ex.: 1234"
              onChange={(e) => patch("software_certificate_number", e.target.value)} />
          </div>
          <div>
            <Label>Versão SAF-T</Label>
            <Input value={cert.saft_version} onChange={(e) => patch("saft_version", e.target.value)} />
          </div>
          <div>
            <Label>ProductID</Label>
            <Input value={cert.product_id} onChange={(e) => patch("product_id", e.target.value)} />
          </div>
          <div>
            <Label>ProductVersion</Label>
            <Input value={cert.product_version} onChange={(e) => patch("product_version", e.target.value)} />
          </div>
          <div>
            <Label>Produtor do software (nome)</Label>
            <Input value={cert.producer_company_name ?? ""} onChange={(e) => patch("producer_company_name", e.target.value)} />
          </div>
          <div>
            <Label>NIF do produtor (ProductCompanyTaxID)</Label>
            <Input value={cert.producer_tax_id ?? ""} onChange={(e) => patch("producer_tax_id", e.target.value)} />
          </div>
          <div>
            <Label>TaxAccountingBasis</Label>
            <Input value={cert.tax_accounting_basis} onChange={(e) => patch("tax_accounting_basis", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>HeaderComment (override opcional)</Label>
            <Textarea rows={2} value={cert.header_comment_override ?? ""}
              placeholder="Vazio = aviso automático conforme o que ainda falta certificar"
              onChange={(e) => patch("header_comment_override", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assinatura digital dos documentos (Hash / HashControl)</CardTitle>
          <CardDescription>
            A chave privada RSA nunca é guardada na base de dados — é lida do segredo indicado.
            Ao ativar, os documentos passam a ser assinados em cadeia (RSA-SHA1) e o hash é imutável.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <Label>Assinatura ativa</Label>
              <p className="text-xs text-muted-foreground">Requer a chave privada guardada no segredo indicado.</p>
            </div>
            <Switch checked={cert.signing_enabled} onCheckedChange={(v) => patch("signing_enabled", v)} />
          </div>
          <div>
            <Label>Nome do segredo com a chave privada (PEM PKCS#8)</Label>
            <Input value={cert.signing_key_secret_name} onChange={(e) => patch("signing_key_secret_name", e.target.value)} />
          </div>
          <div>
            <Label>Versão da chave (HashControl)</Label>
            <Input value={cert.signing_key_version} onChange={(e) => patch("signing_key_version", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Séries de documentos e ATCUD</CardTitle>
          <CardDescription>
            O ATCUD é <code>código de validação da série</code>-<code>nº sequencial</code>.
            Sem código atribuído pela AT o campo sai como <code>0</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Oficina</Label>
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={shopId} onChange={(e) => setShopId(e.target.value)}>
              <option value="">— Selecionar oficina —</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {shopId && (
            <>
              <div className="grid gap-2 sm:grid-cols-5">
                <select className="h-10 rounded-md border bg-background px-2 text-sm"
                  value={newSeries.doc_type} onChange={(e) => setNewSeries({ ...newSeries, doc_type: e.target.value })}>
                  {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <Input placeholder="Série (ex.: 2026A)" value={newSeries.series_code}
                  onChange={(e) => setNewSeries({ ...newSeries, series_code: e.target.value })} />
                <Input placeholder="Código validação AT" value={newSeries.at_validation_code}
                  onChange={(e) => setNewSeries({ ...newSeries, at_validation_code: e.target.value })} />
                <Input placeholder="Nº inicial" value={newSeries.initial_sequence}
                  onChange={(e) => setNewSeries({ ...newSeries, initial_sequence: e.target.value })} />
                <Button onClick={addSeries} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
              </div>

              <div className="space-y-2">
                {series.length === 0 && <p className="text-sm text-muted-foreground">Sem séries registadas para esta oficina.</p>}
                {series.map((s) => (
                  <div key={s.id} className="grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-5">
                    <div className="text-sm font-medium">{s.doc_type} · {s.series_code}</div>
                    <Input defaultValue={s.at_validation_code ?? ""} placeholder="Código validação AT"
                      onBlur={(e) => updateSeries(s.id, { at_validation_code: e.target.value || null })} />
                    <div className="text-xs text-muted-foreground">Início: {s.initial_sequence}</div>
                    <div className="flex items-center gap-2">
                      <Switch checked={s.is_active} onCheckedChange={(v) => updateSeries(s.id, { is_active: v })} />
                      <span className="text-xs">{s.is_active ? "Ativa" : "Inativa"}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="justify-self-end text-destructive"
                      onClick={() => removeSeries(s.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar configuração
        </Button>
      </div>
    </div>
  );
}
