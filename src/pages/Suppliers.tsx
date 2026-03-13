import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Send, RotateCw, Building2, Users, TrendingUp, Percent, Trash2, Eye } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  discount_percent: number;
  integration_active: boolean;
  notes: string | null;
  created_at: string;
}

interface SupplierInvite {
  id: string;
  supplier_id: string;
  shop_name: string;
  shop_email: string;
  shop_phone: string;
  invite_token: string;
  status: string;
  discount_percent: number;
  plan_offer: string;
  trial_days: number;
  sent_at: string | null;
  accepted_at: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  shop_id: string | null;
  created_at: string;
}

export default function Suppliers() {
  const { language } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invites, setInvites] = useState<SupplierInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [showNewInvite, setShowNewInvite] = useState(false);
  const [showInvites, setShowInvites] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contact_email: "", contact_phone: "", discount_percent: "10", notes: "" });
  const [inviteForm, setInviteForm] = useState({ shop_name: "", shop_email: "", shop_phone: "", plan_offer: "pro", trial_days: "30" });

  const t = (key: string) => {
    const texts: Record<string, Record<string, string>> = {
      title: { pt: "Parcerias com Fornecedores", en: "Supplier Partnerships", es: "Asociaciones con Proveedores" },
      newSupplier: { pt: "Novo Fornecedor", en: "New Supplier", es: "Nuevo Proveedor" },
      name: { pt: "Nome", en: "Name", es: "Nombre" },
      email: { pt: "Email", en: "Email", es: "Email" },
      phone: { pt: "Telefone", en: "Phone", es: "Teléfono" },
      discount: { pt: "Desconto (%)", en: "Discount (%)", es: "Descuento (%)" },
      notes: { pt: "Notas", en: "Notes", es: "Notas" },
      save: { pt: "Guardar", en: "Save", es: "Guardar" },
      cancel: { pt: "Cancelar", en: "Cancel", es: "Cancelar" },
      sendInvite: { pt: "Enviar Convite", en: "Send Invite", es: "Enviar Invitación" },
      resend: { pt: "Reenviar", en: "Resend", es: "Reenviar" },
      viewInvites: { pt: "Ver Convites", en: "View Invites", es: "Ver Invitaciones" },
      shopName: { pt: "Nome da Oficina", en: "Shop Name", es: "Nombre del Taller" },
      plan: { pt: "Plano Oferta", en: "Plan Offer", es: "Plan Oferta" },
      trialDays: { pt: "Dias Trial", en: "Trial Days", es: "Días Trial" },
      totalSuppliers: { pt: "Total Fornecedores", en: "Total Suppliers", es: "Total Proveedores" },
      totalInvites: { pt: "Total Convites", en: "Total Invites", es: "Total Invitaciones" },
      accepted: { pt: "Aceites", en: "Accepted", es: "Aceptadas" },
      conversionRate: { pt: "Taxa Conversão", en: "Conversion Rate", es: "Tasa Conversión" },
      pending: { pt: "Pendente", en: "Pending", es: "Pendiente" },
      status: { pt: "Estado", en: "Status", es: "Estado" },
      actions: { pt: "Ações", en: "Actions", es: "Acciones" },
      noSuppliers: { pt: "Nenhum fornecedor registado", en: "No suppliers registered", es: "No hay proveedores registrados" },
      invitesFor: { pt: "Convites de", en: "Invites for", es: "Invitaciones de" },
    };
    return texts[key]?.[language] || texts[key]?.en || key;
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: s }, { data: i }] = await Promise.all([
      supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
      supabase.from("supplier_invites").select("*").order("created_at", { ascending: false }),
    ]);
    setSuppliers((s as Supplier[]) || []);
    setInvites((i as SupplierInvite[]) || []);
    setLoading(false);
  };

  const createSupplier = async () => {
    if (!form.name || !form.contact_email) {
      toast({ title: "Erro", description: "Nome e email são obrigatórios", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("suppliers").insert({
      name: form.name,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      discount_percent: parseFloat(form.discount_percent) || 0,
      notes: form.notes || null,
    } as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅", description: "Fornecedor criado com sucesso" });
    setShowNewSupplier(false);
    setForm({ name: "", contact_email: "", contact_phone: "", discount_percent: "10", notes: "" });
    loadData();
  };

  const createInvite = async () => {
    if (!showInvites || !inviteForm.shop_email) {
      toast({ title: "Erro", description: "Email obrigatório", variant: "destructive" });
      return;
    }
    const supplier = suppliers.find(s => s.id === showInvites);
    const { error } = await supabase.from("supplier_invites").insert({
      supplier_id: showInvites,
      shop_name: inviteForm.shop_name,
      shop_email: inviteForm.shop_email,
      shop_phone: inviteForm.shop_phone,
      plan_offer: inviteForm.plan_offer,
      trial_days: parseInt(inviteForm.trial_days) || 30,
      discount_percent: supplier?.discount_percent || 0,
      status: "pending",
    } as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅", description: "Convite criado com sucesso" });
    setShowNewInvite(false);
    setInviteForm({ shop_name: "", shop_email: "", shop_phone: "", plan_offer: "pro", trial_days: "30" });
    loadData();
  };

  const sendInvite = async (inviteId: string) => {
    // Mark as sent
    await supabase.from("supplier_invites").update({ sent_at: new Date().toISOString(), status: "sent" } as any).eq("id", inviteId);
    toast({ title: "📧", description: "Convite enviado!" });
    loadData();
  };

  const deleteSupplier = async (id: string) => {
    await supabase.from("suppliers").delete().eq("id", id);
    toast({ title: "🗑️", description: "Fornecedor eliminado" });
    loadData();
  };

  const totalAccepted = invites.filter(i => i.status === "accepted").length;
  const totalSent = invites.filter(i => ["sent", "accepted", "expired"].includes(i.status)).length;
  const conversionRate = totalSent > 0 ? ((totalAccepted / totalSent) * 100).toFixed(1) : "0";

  const currentInvites = showInvites ? invites.filter(i => i.supplier_id === showInvites) : [];
  const currentSupplier = showInvites ? suppliers.find(s => s.id === showInvites) : null;

  const statusColor = (status: string) => {
    switch (status) {
      case "accepted": return "default";
      case "sent": return "secondary";
      case "pending": return "outline";
      case "expired": return "destructive";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "pt" ? "Gerir parcerias e convites de fornecedores" : "Manage supplier partnerships and invites"}
          </p>
        </div>
        <Button onClick={() => setShowNewSupplier(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t("newSupplier")}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Building2 className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{suppliers.length}</p>
              <p className="text-xs text-muted-foreground">{t("totalSuppliers")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/50"><Send className="w-5 h-5 text-secondary-foreground" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{invites.length}</p>
              <p className="text-xs text-muted-foreground">{t("totalInvites")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent"><Users className="w-5 h-5 text-accent-foreground" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalAccepted}</p>
              <p className="text-xs text-muted-foreground">{t("accepted")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted"><TrendingUp className="w-5 h-5 text-muted-foreground" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{conversionRate}%</p>
              <p className="text-xs text-muted-foreground">{t("conversionRate")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suppliers List */}
      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">{t("noSuppliers")}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>{t("totalSuppliers")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("phone")}</TableHead>
                  <TableHead>{t("discount")}</TableHead>
                  <TableHead className="text-center">{t("totalInvites")}</TableHead>
                  <TableHead className="text-center">{t("accepted")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map(s => {
                  const sInvites = invites.filter(i => i.supplier_id === s.id);
                  const sAccepted = sInvites.filter(i => i.status === "accepted").length;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.contact_email}</TableCell>
                      <TableCell>{s.contact_phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Percent className="w-3 h-3" />{s.discount_percent}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{sInvites.length}</TableCell>
                      <TableCell className="text-center">{sAccepted}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setShowInvites(s.id)}>
                            <Eye className="w-3.5 h-3.5 mr-1" />{t("viewInvites")}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteSupplier(s.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* New Supplier Dialog */}
      <Dialog open={showNewSupplier} onOpenChange={setShowNewSupplier}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("newSupplier")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>{t("email")}</Label><Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div><Label>{t("phone")}</Label><Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></div>
            <div><Label>{t("discount")}</Label><Input type="number" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} /></div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSupplier(false)}>{t("cancel")}</Button>
            <Button onClick={createSupplier}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invites Panel */}
      <Dialog open={!!showInvites} onOpenChange={(open) => { if (!open) setShowInvites(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("invitesFor")} {currentSupplier?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={() => setShowNewInvite(true)}>
              <Plus className="w-4 h-4 mr-1" />{t("sendInvite")}
            </Button>
          </div>
          {currentInvites.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {language === "pt" ? "Nenhum convite enviado" : "No invites sent"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("shopName")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("plan")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentInvites.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.shop_name || "-"}</TableCell>
                    <TableCell>{inv.shop_email}</TableCell>
                    <TableCell><Badge variant="outline">{inv.plan_offer}</Badge></TableCell>
                    <TableCell><Badge variant={statusColor(inv.status)}>{inv.status}</Badge></TableCell>
                    <TableCell>
                      {(inv.status === "pending" || inv.status === "sent") && (
                        <Button size="sm" variant="outline" onClick={() => sendInvite(inv.id)}>
                          <RotateCw className="w-3.5 h-3.5 mr-1" />{inv.status === "pending" ? t("sendInvite") : t("resend")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* New Invite Dialog */}
      <Dialog open={showNewInvite} onOpenChange={setShowNewInvite}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("sendInvite")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("shopName")}</Label><Input value={inviteForm.shop_name} onChange={e => setInviteForm({ ...inviteForm, shop_name: e.target.value })} /></div>
            <div><Label>{t("email")}</Label><Input type="email" value={inviteForm.shop_email} onChange={e => setInviteForm({ ...inviteForm, shop_email: e.target.value })} /></div>
            <div><Label>{t("phone")}</Label><Input value={inviteForm.shop_phone} onChange={e => setInviteForm({ ...inviteForm, shop_phone: e.target.value })} /></div>
            <div>
              <Label>{t("plan")}</Label>
              <Select value={inviteForm.plan_offer} onValueChange={v => setInviteForm({ ...inviteForm, plan_offer: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="garage">Garage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("trialDays")}</Label><Input type="number" value={inviteForm.trial_days} onChange={e => setInviteForm({ ...inviteForm, trial_days: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewInvite(false)}>{t("cancel")}</Button>
            <Button onClick={createInvite}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
