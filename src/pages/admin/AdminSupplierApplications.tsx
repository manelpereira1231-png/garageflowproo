import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, Eye } from "lucide-react";

type App = any;

export default function AdminSupplierApplications() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [rows, setRows] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<App | null>(null);
  const [approving, setApproving] = useState<App | null>(null);
  const [approveOwnerId, setApproveOwnerId] = useState("");
  const [approveCommission, setApproveCommission] = useState("5");
  const [rejecting, setRejecting] = useState<App | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("gsn_supplier_applications" as any).select("*").order("created_at", { ascending: false });
    if (tab !== "all") q = q.eq("state", tab);
    const { data } = await q;
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [tab]);

  const approve = async () => {
    if (!approving) return;
    if (!approveOwnerId.trim()) return toast.error("Owner user ID obrigatório. Crie primeiro o utilizador em Auth.");
    setBusy(true);
    const { error } = await supabase.rpc("gsn_approve_application" as any, {
      _app_id: approving.id, _owner_user_id: approveOwnerId.trim(), _commission: Number(approveCommission) || 5,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Candidatura aprovada. Envie ao fornecedor o link de reset de palavra-passe.");
    setApproving(null); setApproveOwnerId(""); void load();
  };

  const reject = async () => {
    if (!rejecting) return;
    if (!rejectReason.trim()) return toast.error("Indique o motivo");
    setBusy(true);
    const { error } = await supabase.rpc("gsn_reject_application" as any, { _app_id: rejecting.id, _reason: rejectReason.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Candidatura rejeitada");
    setRejecting(null); setRejectReason(""); void load();
  };

  const stateBadge = (s: string) => {
    const map: any = { pending: "secondary", approved: "default", rejected: "outline", pending_approval: "secondary" };
    return <Badge variant={map[s] ?? "outline"}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Candidaturas de Fornecedores</h1>
        <p className="text-sm text-muted-foreground">Analise, aprove ou rejeite candidaturas públicas à Supplier Network.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovadas</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardHeader><CardTitle>{rows.length} candidatura(s)</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">A carregar...</div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Sem resultados.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr className="text-left text-xs uppercase text-muted-foreground">
                        <th className="px-4 py-3">Empresa</th>
                        <th className="px-4 py-3">Responsável</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Cidade</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                          <td className="px-4 py-3 font-medium">{r.company_name}</td>
                          <td className="px-4 py-3">{r.responsible_name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.city || "—"}</td>
                          <td className="px-4 py-3">{stateBadge(r.state)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-PT")}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setViewing(r)}><Eye className="w-4 h-4" /></Button>
                              {r.state === "pending" && (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => setApproving(r)} title="Aprovar"><Check className="w-4 h-4 text-emerald-500" /></Button>
                                  <Button size="sm" variant="ghost" onClick={() => setRejecting(r)} title="Rejeitar"><X className="w-4 h-4 text-destructive" /></Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{viewing?.company_name}</DialogTitle>
            <DialogDescription>Detalhes da candidatura</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-2 text-sm">
              {Object.entries(viewing).map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-2 border-b py-1">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="col-span-2 break-all">{Array.isArray(v) ? v.join(", ") : String(v ?? "—")}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve */}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aprovar candidatura</DialogTitle>
            <DialogDescription>
              Requer o UUID do utilizador (crie primeiro em Backend → Auth com o email da candidatura, ou peça ao fornecedor para se registar em /auth).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Owner user ID (UUID)</Label><Input value={approveOwnerId} onChange={(e) => setApproveOwnerId(e.target.value)} placeholder="00000000-…" /></div>
            <div><Label>Comissão (%)</Label><Input type="number" step="0.01" value={approveCommission} onChange={(e) => setApproveCommission(e.target.value)} /></div>
            <Button onClick={approve} disabled={busy} className="w-full">{busy ? "A aprovar..." : "Confirmar aprovação"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar candidatura</DialogTitle>
            <DialogDescription>Indique o motivo (será registado).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} />
            <Button onClick={reject} disabled={busy} variant="destructive" className="w-full">{busy ? "A rejeitar..." : "Confirmar rejeição"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
