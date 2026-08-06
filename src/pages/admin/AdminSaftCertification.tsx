import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldCheck, ShieldAlert, FileCheck2, Plus, Trash2, Check, X, AlertTriangle } from "lucide-react";
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
  const original = useRef<Cert | null>(null);
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
      if (c) {
        setCert(c as unknown as Cert);
        original.current = c as unknown as Cert;
      }
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

  const dirty = useMemo(
    () => !!cert && !!original.current && JSON.stringify(cert) !== JSON.stringify(original.current),
    [cert],
  );

  // Avisa antes de sair com alterações por guardar
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!cert) return e;
    const num = (cert.software_certificate_number ?? "").trim();
    if (num && !/^\d{1,6}$/.test(num)) e.push("O nº de certificado da AT deve conter apenas dígitos.");
    if (cert.is_certified && !num) e.push("Não é possível marcar como certificado sem o nº de certificado da AT.");
    const nif = (cert.producer_tax_id ?? "").trim();
    if (nif && !/^\d{9}$/.test(nif)) e.push("O NIF do produtor deve ter 9 dígitos.");
    if (!cert.product_id.trim()) e.push("O ProductID não pode ficar vazio.");
    if (!cert.product_version.trim()) e.push("A ProductVersion não pode ficar vazia.");
    if (!/^\d+(\.\d+)*(_\d+)?$/.test(cert.saft_version.trim())) e.push("Versão SAF-T inválida (ex.: 1.04_01).");
    if (!/^[A-Z]$/.test(cert.tax_accounting_basis.trim())) e.push("TaxAccountingBasis deve ser uma letra (ex.: F).");
    if (cert.signing_enabled && !cert.signing_key_secret_name.trim())
      e.push("Indique o nome do segredo com a chave privada para ativar a assinatura.");
    if (cert.signing_enabled && !/^\d+$/.test(cert.signing_key_version.trim()))
      e.push("A versão da chave (HashControl) deve ser numérica.");
    return e;
  }, [cert]);

  const save = async () => {
    if (!cert) return;
    if (errors.length) { toast.error(errors[0]); return; }
    setSaving(true);
    const payload = {
      is_certified: cert.is_certified,
      software_certificate_number: cert.software_certificate_number?.trim() || null,
      product_id: cert.product_id.trim(),
      product_version: cert.product_version.trim(),
      producer_company_name: cert.producer_company_name?.trim() || null,
      producer_tax_id: cert.producer_tax_id?.trim() || null,
      saft_version: cert.saft_version.trim(),
      tax_accounting_basis: cert.tax_accounting_basis.trim().toUpperCase(),
      signing_enabled: cert.signing_enabled,
      signing_key_secret_name: cert.signing_key_secret_name.trim(),
      signing_key_version: cert.signing_key_version.trim(),
      header_comment_override: cert.header_comment_override?.trim() || null,
    };
    const { error } = await supabase
      .from("saft_certification_settings" as any)
      .update(payload)
      .eq("id", cert.id);
    setSaving(false);
    if (error) { toast.error("Sem permissão ou erro ao guardar."); return; }
    const next = { ...cert, ...payload } as Cert;
    setCert(next);
    original.current = next;
    toast.success("Configuração de certificação guardada.");
  };

  const addSeries = async () => {
    if (!shopId || !newSeries.series_code.trim()) {
      toast.error("Escolha uma oficina e indique o código da série.");
      return;
    }
    const code = newSeries.series_code.trim().toUpperCase();
    if (series.some((s) => s.doc_type === newSeries.doc_type && s.series_code.toUpperCase() === code)) {
      toast.error("Já existe uma série com esse código para este tipo de documento.");
      return;
    }
    const seq = Number(newSeries.initial_sequence);
    if (!Number.isInteger(seq) || seq < 1) {
      toast.error("O nº inicial deve ser um inteiro igual ou superior a 1.");
      return;
    }
    const { data, error } = await supabase.from("document_series" as any).insert({
      shop_id: shopId,
      doc_type: newSeries.doc_type,
      series_code: code,
      at_validation_code: newSeries.at_validation_code.trim().toUpperCase() || null,
      initial_sequence: seq,
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
    const s = series.find((x) => x.id === id);
    if (!window.confirm(`Remover a série ${s?.doc_type} · ${s?.series_code}? Esta ação não pode ser anulada.`)) return;
    const { error } = await supabase.from("document_series" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSeries((p) => p.filter((x) => x.id !== id));
    toast.success("Série removida.");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!cert) {
    return <div className="p-6 text-sm text-muted-foreground">Sem acesso à configuração de certificação (apenas Super Admin).</div>;
  }

  const ready = cert.is_certified && !!cert.software_certificate_number;
  const hasActiveSeriesWithCode = series.some((s) => s.is_active && !!s.at_validation_code);

  const checklist = [
    { ok: ready, label: "Nº de certificado atribuído pela AT (SoftwareCertificateNumber)" },
    { ok: !!cert.producer_company_name && !!cert.producer_tax_id, label: "Dados do produtor de software (nome + NIF)" },
    { ok: cert.signing_enabled, label: "Assinatura digital ativa (Hash / HashControl)" },
    {
      ok: !!shopId && hasActiveSeriesWithCode,
      label: shopId
        ? "Séries ativas com código de validação AT (ATCUD) na oficina selecionada"
        : "Séries com código de validação AT (selecione uma oficina para verificar)",
    },
  ];
  const pending = checklist.filter((c) => !c.ok);

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
        {dirty && <Badge variant="secondary">Alterações por guardar</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado da conformidade</CardTitle>
          <CardDescription>
            {pending.length === 0
              ? "Todos os requisitos configurados. O SAF-T deixa de incluir o aviso de software não certificado."
              : `Faltam ${pending.length} requisito(s). Enquanto assim for, o XML sai com placeholders "0" e o aviso legal no cabeçalho.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {checklist.map((c) => (
            <div key={c.label} className="flex items-start gap-2 text-sm">
              {c.ok
                ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                : <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Card className="border-destructive/50">
          <CardContent className="space-y-1 py-4">
            {errors.map((e) => (
              <div key={e} className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{e}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
            <Switch
              checked={cert.is_certified}
              onCheckedChange={(v) => {
                if (v && !(cert.software_certificate_number ?? "").trim()) {
                  toast.error("Preencha primeiro o nº de certificado atribuído pela AT.");
                  return;
                }
                patch("is_certified", v);
              }}
            />
          </div>
          <div>
            <Label>Nº de certificado (SoftwareCertificateNumber)</Label>
            <Input value={cert.software_certificate_number ?? ""} placeholder="Ex.: 1234" inputMode="numeric"
              onChange={(e) => patch("software_certificate_number", e.target.value.replace(/\D/g, ""))} />
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
            <Input value={cert.producer_tax_id ?? ""} inputMode="numeric" maxLength={9}
              onChange={(e) => patch("producer_tax_id", e.target.value.replace(/\D/g, "").slice(0, 9))} />
          </div>
          <div>
            <Label>TaxAccountingBasis</Label>
            <Input value={cert.tax_accounting_basis} maxLength={1}
              onChange={(e) => patch("tax_accounting_basis", e.target.value.toUpperCase())} />
          </div>
          <div className="sm:col-span-2">
            <Label>HeaderComment (override opcional)</Label>
            <Textarea rows={2} value={cert.header_comment_override ?? ""}
              placeholder="Vazio = aviso automático conforme o que ainda falta certificar"
              onChange={(e) => patch("header_comment_override", e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              Atenção: preencher este campo substitui o aviso automático. Só o faça se o conteúdo for legalmente correto.
            </p>
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
            <Switch
              checked={cert.signing_enabled}
              onCheckedChange={(v) => {
                if (v && !cert.signing_key_secret_name.trim()) {
                  toast.error("Indique o nome do segredo com a chave privada antes de ativar.");
                  return;
                }
                patch("signing_enabled", v);
              }}
            />
          </div>
          <div>
            <Label>Nome do segredo com a chave privada (PEM PKCS#8)</Label>
            <Input value={cert.signing_key_secret_name} onChange={(e) => patch("signing_key_secret_name", e.target.value)} />
          </div>
          <div>
            <Label>Versão da chave (HashControl)</Label>
            <Input value={cert.signing_key_version} inputMode="numeric"
              onChange={(e) => patch("signing_key_version", e.target.value.replace(/\D/g, ""))} />
            <p className="mt-1 text-xs text-muted-foreground">
              Incrementar apenas quando a chave privada for substituída. Documentos já assinados mantêm a versão anterior.
            </p>
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
                  onChange={(e) => setNewSeries({ ...newSeries, series_code: e.target.value.toUpperCase() })} />
                <Input placeholder="Código validação AT" value={newSeries.at_validation_code}
                  onChange={(e) => setNewSeries({ ...newSeries, at_validation_code: e.target.value.toUpperCase() })} />
                <Input placeholder="Nº inicial" inputMode="numeric" value={newSeries.initial_sequence}
                  onChange={(e) => setNewSeries({ ...newSeries, initial_sequence: e.target.value.replace(/\D/g, "") })} />
                <Button onClick={addSeries} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
              </div>

              <div className="space-y-2">
                {series.length === 0 && <p className="text-sm text-muted-foreground">Sem séries registadas para esta oficina.</p>}
                {series.map((s) => (
                  <div key={s.id} className="grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-5">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {s.doc_type} · {s.series_code}
                      {!s.at_validation_code && (
                        <Badge variant="outline" className="text-[10px]">ATCUD = 0</Badge>
                      )}
                    </div>
                    <Input defaultValue={s.at_validation_code ?? ""} placeholder="Código validação AT"
                      onBlur={(e) => {
                        const v = e.target.value.trim().toUpperCase() || null;
                        if (v !== (s.at_validation_code ?? null)) updateSeries(s.id, { at_validation_code: v });
                      }} />
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

      <div className="flex items-center justify-end gap-3">
        {dirty && (
          <Button variant="ghost" onClick={() => setCert(original.current)} disabled={saving}>
            Descartar alterações
          </Button>
        )}
        <Button onClick={save} disabled={saving || !dirty || errors.length > 0} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar configuração
        </Button>
      </div>
    </div>
  );
}
