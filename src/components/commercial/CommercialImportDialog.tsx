import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { parseFile, type ParsedLead } from "@/lib/commercial/fileParsers";

type Shop = { id: string; name: string; email?: string | null; phone?: string | null };
type ExistingLead = { id: string; name: string; email?: string | null; phone?: string | null };
type MatchDecision = "update" | "skip" | "create_new";
type Row = ParsedLead & {
  _matchShop?: Shop | null;
  _matchLead?: ExistingLead | null;
  _decision: MatchDecision;
};

function normEmail(s?: string | null) {
  return (s || "").trim().toLowerCase();
}
function normPhone(s?: string | null) {
  return (s || "").replace(/\D+/g, "");
}

export default function CommercialImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [step, setStep] = useState<"upload" | "review">("upload");

  const stats = useMemo(() => {
    let matchesShop = 0, matchesLead = 0, fresh = 0;
    rows.forEach((r) => {
      if (r._matchShop) matchesShop++;
      else if (r._matchLead) matchesLead++;
      else fresh++;
    });
    return { matchesShop, matchesLead, fresh, total: rows.length };
  }, [rows]);

  const reset = () => {
    setRows([]);
    setFileName("");
    setStep("upload");
    setBusy(false);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setFileName(file.name);
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) {
        toast.error("Não foi possível extrair oficinas deste ficheiro.");
        setBusy(false);
        return;
      }
      // Fetch existing shops + leads to match against
      const [shopsRes, leadsRes] = await Promise.all([
        supabase.from("shops").select("id, name, email, phone"),
        supabase.from("crm_leads" as any).select("id, name, email, phone"),
      ]);
      const shops = ((shopsRes.data as unknown) || []) as Shop[];
      const leads = ((leadsRes.data as unknown) || []) as ExistingLead[];

      const shopByEmail = new Map<string, Shop>();
      const shopByPhone = new Map<string, Shop>();
      shops.forEach((s) => {
        if (s.email) shopByEmail.set(normEmail(s.email), s);
        if (s.phone) shopByPhone.set(normPhone(s.phone), s);
      });
      const leadByEmail = new Map<string, ExistingLead>();
      const leadByPhone = new Map<string, ExistingLead>();
      leads.forEach((l) => {
        if (l.email) leadByEmail.set(normEmail(l.email), l);
        if (l.phone) leadByPhone.set(normPhone(l.phone), l);
      });

      const enriched: Row[] = parsed.map((p) => {
        const em = normEmail(p.email);
        const ph = normPhone(p.phone);
        const matchShop =
          (em && shopByEmail.get(em)) || (ph && shopByPhone.get(ph)) || null;
        const matchLead =
          !matchShop &&
          ((em && leadByEmail.get(em)) || (ph && leadByPhone.get(ph)) || null);
        return {
          ...p,
          _matchShop: matchShop || null,
          _matchLead: matchLead || null,
          _decision: matchShop || matchLead ? "update" : "create_new",
        };
      });
      setRows(enriched);
      setStep("review");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao ler ficheiro");
    } finally {
      setBusy(false);
    }
  };

  const setDecision = (idx: number, d: MatchDecision) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, _decision: d } : r)));
  };

  const confirm = async () => {
    setBusy(true);
    const batchId = crypto.randomUUID();
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;

    const inserts: any[] = [];
    const updates: { id: string; patch: any }[] = [];
    const activities: any[] = [];

    for (const r of rows) {
      if (r._decision === "skip") continue;

      const payload = {
        name: r.name || r.owner_name || r.email || "Sem nome",
        owner_name: r.owner_name || null,
        email: r.email || null,
        phone: r.phone || null,
        address: r.address || null,
        city: r.city || null,
        district: r.district || null,
        country: r.country || null,
        website: r.website || null,
        source: "import",
        import_batch_id: batchId,
      };

      if (r._decision === "update" && r._matchLead) {
        updates.push({ id: r._matchLead.id, patch: payload });
        activities.push({
          lead_id: r._matchLead.id,
          kind: "imported",
          summary: `Atualizado via importação de ${fileName}`,
          meta: { batchId, action: "update_lead" },
          created_by: uid,
        });
      } else if (r._decision === "update" && r._matchShop) {
        // Link a lead record to the existing shop (create lead if missing)
        inserts.push({
          ...payload,
          pipeline_stage: "customer",
          status: "won",
          shop_link_id: r._matchShop.id,
          shop_id: r._matchShop.id,
          created_by: uid,
        });
      } else {
        inserts.push({
          ...payload,
          pipeline_stage: "lead",
          status: "open",
          created_by: uid,
        });
      }
    }

    // Batch updates
    for (const u of updates) {
      await supabase.from("crm_leads" as any).update(u.patch).eq("id", u.id);
    }
    // Batch inserts
    let inserted: any[] = [];
    if (inserts.length > 0) {
      const { data, error } = await supabase
        .from("crm_leads" as any)
        .insert(inserts)
        .select("id, name");
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      inserted = (data as any[]) || [];
      inserted.forEach((row) =>
        activities.push({
          lead_id: row.id,
          kind: "imported",
          summary: `Criado via importação de ${fileName}`,
          meta: { batchId, action: "insert_lead" },
          created_by: uid,
        }),
      );
    }
    if (activities.length > 0) {
      await supabase.from("crm_activity" as any).insert(activities);
    }

    toast.success(
      `Importação concluída — ${inserted.length} novos, ${updates.length} atualizados`,
    );
    onImported();
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar oficinas — Excel · CSV · PDF · Word</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription className="text-sm">
                O ficheiro é analisado no navegador. O sistema tenta reconhecer automaticamente
                <strong> nome, responsável, email, telefone, morada, cidade, país e website</strong>.
                Se uma oficina já existir (por email ou telefone) pode escolher
                <strong> atualizar</strong>, <strong>ignorar</strong> ou <strong>criar novo registo</strong>.
              </AlertDescription>
            </Alert>
            <label
              htmlFor="commercial-import-file"
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 cursor-pointer hover:border-primary transition-colors"
            >
              {busy ? (
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Clique para escolher um ficheiro</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    .xlsx · .xls · .csv · .pdf · .docx
                  </p>
                </>
              )}
              <input
                id="commercial-import-file"
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <Badge variant="outline">{stats.total} registos</Badge>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="w-3 h-3" /> {stats.fresh} novos
              </Badge>
              <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" /> {stats.matchesLead} coincidem com leads
              </Badge>
              <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" /> {stats.matchesShop} já são oficinas
              </Badge>
            </div>

            <div className="max-h-[45vh] overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs sticky top-0">
                  <tr>
                    <th className="text-left p-2">Oficina</th>
                    <th className="text-left p-2">Contacto</th>
                    <th className="text-left p-2">Estado</th>
                    <th className="text-left p-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const matched = r._matchShop || r._matchLead;
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-2">
                          <div className="font-medium">{r.name || "—"}</div>
                          {r.owner_name && (
                            <div className="text-xs text-muted-foreground">{r.owner_name}</div>
                          )}
                        </td>
                        <td className="p-2 text-xs">
                          {r.email && <div>{r.email}</div>}
                          {r.phone && <div className="text-muted-foreground">{r.phone}</div>}
                        </td>
                        <td className="p-2">
                          {r._matchShop ? (
                            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/15">
                              Já é oficina
                            </Badge>
                          ) : r._matchLead ? (
                            <Badge variant="outline">Lead existente</Badge>
                          ) : (
                            <Badge variant="secondary">Novo</Badge>
                          )}
                        </td>
                        <td className="p-2">
                          {matched ? (
                            <RadioGroup
                              value={r._decision}
                              onValueChange={(v) => setDecision(i, v as MatchDecision)}
                              className="flex gap-3"
                            >
                              <label className="flex items-center gap-1 text-xs cursor-pointer">
                                <RadioGroupItem value="update" id={`u-${i}`} />
                                Atualizar
                              </label>
                              <label className="flex items-center gap-1 text-xs cursor-pointer">
                                <RadioGroupItem value="skip" id={`s-${i}`} />
                                Ignorar
                              </label>
                              <label className="flex items-center gap-1 text-xs cursor-pointer">
                                <RadioGroupItem value="create_new" id={`n-${i}`} />
                                Criar novo
                              </label>
                            </RadioGroup>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Criar novo
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={busy}>
                Escolher outro ficheiro
              </Button>
              <Button onClick={confirm} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar importação
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// unused import guard
void Label;
