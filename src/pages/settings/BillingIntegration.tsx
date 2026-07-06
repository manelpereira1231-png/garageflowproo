/**
 * Definições → Faturação Certificada (por oficina)
 *
 * Suporta InvoiceXpress (API key) e Moloni (OAuth password grant).
 * A oficina liga a SUA PRÓPRIA conta. Credenciais encriptadas AES-GCM antes de gravar.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldCheck, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Provider = "invoicexpress" | "moloni";

type Row = {
  id: string;
  shop_id: string;
  provider: Provider;
  account_name: string;
  serie_default: string | null;
  documento_default: string;
  moloni_company_id: number | null;
  ativo: boolean;
  last_test_ok_at: string | null;
  last_error: string | null;
};

export default function BillingIntegration() {
  const shopId = useActiveShopId();
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  const [provider, setProvider] = useState<Provider>("invoicexpress");
  // Shared
  const [serie, setSerie] = useState("");
  const [documento, setDocumento] = useState("invoice");
  // InvoiceXpress
  const [accountName, setAccountName] = useState("");
  const [apiKey, setApiKey] = useState("");
  // Moloni
  const [moloniEmail, setMoloniEmail] = useState("");
  const [moloniPassword, setMoloniPassword] = useState("");
  const [moloniCompanyId, setMoloniCompanyId] = useState("");

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("integracao_faturacao")
        .select("id, shop_id, provider, account_name, serie_default, documento_default, moloni_company_id, ativo, last_test_ok_at, last_error")
        .eq("shop_id", shopId)
        .maybeSingle();
      if (data) {
        const r = data as unknown as Row;
        setRow(r);
        setProvider(r.provider);
        setSerie(r.serie_default || "");
        setDocumento(r.documento_default);
        if (r.provider === "invoicexpress") {
          setAccountName(r.account_name);
        } else {
          setMoloniEmail(r.account_name);
          setMoloniCompanyId(r.moloni_company_id ? String(r.moloni_company_id) : "");
        }
      }
      setLoading(false);
    })();
  }, [shopId]);

  const invoke = async (test_only: boolean) => {
    if (!shopId) return;
    const setter = test_only ? setTesting : setSaving;
    setter(true);
    try {
      let fn = "invoicexpress-connect";
      let body: Record<string, unknown> = {};
      if (provider === "invoicexpress") {
        if (!accountName.trim() || !apiKey.trim()) {
          toast.error("Nome da conta e API key são obrigatórios");
          return;
        }
        body = {
          shop_id: shopId,
          account_name: accountName.trim(),
          api_key: apiKey.trim(),
          serie_default: serie.trim() || null,
          documento_default: documento,
          test_only,
        };
      } else {
        fn = "moloni-connect";
        if (!moloniEmail.trim() || !moloniPassword.trim() || !moloniCompanyId.trim()) {
          toast.error("Email, password e Company ID Moloni são obrigatórios");
          return;
        }
        body = {
          shop_id: shopId,
          account_email: moloniEmail.trim(),
          account_password: moloniPassword,
          moloni_company_id: Number(moloniCompanyId),
          serie_default: serie.trim() || null,
          documento_default: documento,
          test_only,
        };
      }

      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          const resp: Response | undefined = ctx instanceof Response ? ctx : ctx?.response;
          if (resp) {
            const b = await resp.clone().json().catch(() => null);
            if (b?.error) msg = b.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(test_only ? "Ligação OK" : "Integração gravada e testada");
      if (!test_only) {
        setApiKey(""); setMoloniPassword("");
        const { data: fresh } = await supabase
          .from("integracao_faturacao")
          .select("id, shop_id, provider, account_name, serie_default, documento_default, moloni_company_id, ativo, last_test_ok_at, last_error")
          .eq("shop_id", shopId)
          .maybeSingle();
        if (fresh) setRow(fresh as unknown as Row);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro na ligação", { duration: 8000 });
    } finally {
      setter(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/settings"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Definições</Button></Link>
        <div>
          <h1 className="text-xl font-bold">Faturação Certificada</h1>
          <p className="text-sm text-muted-foreground">Liga a tua conta InvoiceXpress ou Moloni. As faturas são emitidas com ATCUD, QR Code, hash e SAF-T oficial sob a conta AT da tua oficina.</p>
        </div>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Como funciona</AlertTitle>
        <AlertDescription className="text-sm">
          O GarageFlow envia os dados da fatura → o provider certificado (InvoiceXpress ou Moloni) emite o documento legal com ATCUD, QR Code, hash e numeração sequencial → guardamos a referência e o PDF certificado. O SAF-T oficial descarrega-se do painel do provider.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> A carregar…</div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Ligação ao provider
                  {row && (
                    <Badge variant={row.last_test_ok_at ? "default" : "secondary"} className="ml-2">
                      {row.last_test_ok_at ? <><CheckCircle2 className="w-3 h-3 mr-1" />Ativa</> : "Pendente"}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {row?.last_test_ok_at
                    ? `Última verificação: ${new Date(row.last_test_ok_at).toLocaleString("pt-PT")}`
                    : "Ainda não ligado"}
                </CardDescription>
              </div>
              <a
                href={provider === "moloni" ? "https://www.moloni.pt" : "https://invoicexpress.com/pt"}
                target="_blank" rel="noreferrer"
                className="text-xs text-primary flex items-center gap-1"
              >
                {provider === "moloni" ? "Moloni" : "InvoiceXpress"} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {row?.last_error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Último erro</AlertTitle>
                <AlertDescription className="text-xs break-all">{row.last_error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoicexpress">InvoiceXpress (recomendado)</SelectItem>
                  <SelectItem value="moloni" disabled>Moloni — em breve</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                InvoiceXpress cobre 100% dos requisitos legais AT: ATCUD, QR Code, hash, série sequencial e SAF-T oficial.
              </p>
            </div>

            {provider === "invoicexpress" ? (
              <>
                <div>
                  <Label>Nome da conta (subdomínio)</Label>
                  <Input placeholder="minhaoficina" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Se acedes em <code>minhaoficina.app.invoicexpress.com</code>, escreve <code>minhaoficina</code>.
                  </p>
                </div>
                <div>
                  <Label>API Key</Label>
                  <Input type="password" placeholder={row?.provider === "invoicexpress" ? "•••••••• (deixa em branco para manter)" : "Cola a tua API key"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="new-password" />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    No InvoiceXpress: <strong>Definições → API</strong>. A chave é encriptada e nunca é devolvida ao browser.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Email Moloni</Label>
                    <Input type="email" placeholder="oficina@exemplo.pt" value={moloniEmail} onChange={(e) => setMoloniEmail(e.target.value)} autoComplete="off" />
                  </div>
                  <div>
                    <Label>Company ID Moloni</Label>
                    <Input inputMode="numeric" placeholder="ex: 12345" value={moloniCompanyId} onChange={(e) => setMoloniCompanyId(e.target.value.replace(/\D/g, ""))} />
                    <p className="text-[11px] text-muted-foreground mt-1">Vê em Moloni → Definições → Empresa.</p>
                  </div>
                </div>
                <div>
                  <Label>Password Moloni</Label>
                  <Input type="password" placeholder={row?.provider === "moloni" ? "•••••••• (deixa em branco para manter)" : "Password da tua conta Moloni"} value={moloniPassword} onChange={(e) => setMoloniPassword(e.target.value)} autoComplete="new-password" />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    A password é usada uma vez para obter tokens OAuth (access + refresh) e depois descartada. Só os tokens ficam encriptados.
                  </p>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Tipo de documento por defeito</Label>
                <Select value={documento} onValueChange={setDocumento}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Fatura (FT)</SelectItem>
                    <SelectItem value="invoice_receipt">Fatura-Recibo (FR)</SelectItem>
                    <SelectItem value="simplified_invoice">Fatura Simplificada (FS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Série (opcional)</Label>
                <Input placeholder={provider === "moloni" ? "document_set_id (ex: 42)" : "ex: A"} value={serie} onChange={(e) => setSerie(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => invoke(true)} disabled={testing || saving}>
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Testar ligação
              </Button>
              <Button onClick={() => invoke(false)} disabled={testing || saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
