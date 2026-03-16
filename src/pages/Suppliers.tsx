import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useShopContext } from "@/hooks/useShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SupplierPartsSearch from "@/components/SupplierPartsSearch";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Send,
  RotateCw,
  Building2,
  Users,
  Percent,
  Trash2,
  Eye,
  Package,
  ShoppingCart,
  CheckCircle2,
} from "lucide-react";

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

interface SupplierCatalogPart {
  id: string;
  supplier_id: string;
  name: string;
  brand: string;
  price: number;
  stock_available: number;
}

export default function Suppliers() {
  const { language } = useLanguage();
  const { activeShop, activeShopId } = useShopContext();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invites, setInvites] = useState<SupplierInvite[]>([]);
  const [supplierParts, setSupplierParts] = useState<SupplierCatalogPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [showNewInvite, setShowNewInvite] = useState(false);
  const [showInvites, setShowInvites] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSupplierId, setCatalogSupplierId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contact_email: "", contact_phone: "", discount_percent: "10", notes: "" });
  const [inviteForm, setInviteForm] = useState({ shop_name: "", shop_email: "", shop_phone: "", plan_offer: "pro", trial_days: "30" });

  const t = (key: string) => {
    const texts: Record<string, Record<string, string>> = {
      title: { pt: "Parcerias com Fornecedores", en: "Supplier Partnerships", es: "Asociaciones con Proveedores" },
      subtitle: { pt: "Gerir fornecedores e comprar peças reais de forma simples.", en: "Manage suppliers and buy real parts easily.", es: "Gestiona proveedores y compra piezas reales fácilmente." },
      newSupplier: { pt: "Novo Fornecedor", en: "New Supplier", es: "Nuevo Proveedor" },
      openCatalog: { pt: "Comprar Peças", en: "Buy Parts", es: "Comprar Piezas" },
      readyToBuy: { pt: "Catálogo pronto a encomendar", en: "Catalog ready to order", es: "Catálogo listo para pedir" },
      readyToBuyDesc: {
        pt: "Escolha um fornecedor, procure por peça ou referência, adicione ao carrinho e envie o pedido diretamente para a oficina ativa.",
        en: "Choose a supplier, search by part or reference, add items to cart, and send the order directly for the active shop.",
        es: "Elige un proveedor, busca por pieza o referencia, añade al carrito y envía el pedido directamente para el taller activo.",
      },
      activeShop: { pt: "Oficina ativa", en: "Active shop", es: "Taller activo" },
      selectShop: { pt: "Selecione uma oficina ativa para poder encomendar peças.", en: "Select an active shop before ordering parts.", es: "Selecciona un taller activo antes de pedir piezas." },
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
      partsCatalog: { pt: "Peças no Catálogo", en: "Catalog Parts", es: "Piezas en Catálogo" },
      partsReady: { pt: "Peças com Stock", en: "Parts in Stock", es: "Piezas con Stock" },
      accepted: { pt: "Aceites", en: "Accepted", es: "Aceptadas" },
      status: { pt: "Estado", en: "Status", es: "Estado" },
      actions: { pt: "Ações", en: "Actions", es: "Acciones" },
      noSuppliers: { pt: "Nenhum fornecedor registado", en: "No suppliers registered", es: "No hay proveedores registrados" },
      invitesFor: { pt: "Convites de", en: "Invites for", es: "Invitaciones de" },
      supplierManagement: { pt: "Gestão de fornecedores", en: "Supplier management", es: "Gestión de proveedores" },
      buyFlow1: { pt: "1. Escolher fornecedor", en: "1. Choose supplier", es: "1. Elegir proveedor" },
      buyFlow2: { pt: "2. Procurar peça", en: "2. Find part", es: "2. Buscar pieza" },
      buyFlow3: { pt: "3. Adicionar ao carrinho", en: "3. Add to cart", es: "3. Añadir al carrito" },
      buyFlow4: { pt: "4. Confirmar encomenda", en: "4. Confirm order", es: "4. Confirmar pedido" },
      catalogItems: { pt: "Itens catálogo", en: "Catalog items", es: "Ítems catálogo" },
      inStock: { pt: "Em stock", en: "In stock", es: "En stock" },
      buyFromSupplier: { pt: "Comprar deste fornecedor", en: "Buy from supplier", es: "Comprar de este proveedor" },
      noInvitesSent: { pt: "Nenhum convite enviado", en: "No invites sent", es: "No invitations sent" },
    };

    return texts[key]?.[language] || texts[key]?.en || key;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: suppliersData }, { data: invitesData }, { data: partsData }] = await Promise.all([
      supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
      supabase.from("supplier_invites").select("*").order("created_at", { ascending: false }),
      supabase.from("supplier_parts").select("id, supplier_id, name, brand, price, stock_available").order("name"),
    ]);

    setSuppliers((suppliersData as Supplier[]) || []);
    setInvites((invitesData as SupplierInvite[]) || []);
    setSupplierParts((partsData as SupplierCatalogPart[]) || []);
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

    const supplier = suppliers.find((item) => item.id === showInvites);
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
    await supabase.from("supplier_invites").update({ sent_at: new Date().toISOString(), status: "sent" } as any).eq("id", inviteId);
    toast({ title: "📧", description: "Convite enviado!" });
    loadData();
  };

  const deleteSupplier = async (id: string) => {
    await supabase.from("suppliers").delete().eq("id", id);
    toast({ title: "🗑️", description: "Fornecedor eliminado" });
    loadData();
  };

  const openCatalog = (supplierId?: string) => {
    setCatalogSupplierId(supplierId || null);
    setCatalogOpen(true);
  };

  const partsBySupplier = useMemo(
    () =>
      supplierParts.reduce<Record<string, number>>((acc, part) => {
        acc[part.supplier_id] = (acc[part.supplier_id] || 0) + 1;
        return acc;
      }, {}),
    [supplierParts],
  );

  const inStockBySupplier = useMemo(
    () =>
      supplierParts.reduce<Record<string, number>>((acc, part) => {
        if (part.stock_available > 0) {
          acc[part.supplier_id] = (acc[part.supplier_id] || 0) + 1;
        }
        return acc;
      }, {}),
    [supplierParts],
  );

  const totalAccepted = invites.filter((invite) => invite.status === "accepted").length;
  const currentInvites = showInvites ? invites.filter((invite) => invite.supplier_id === showInvites) : [];
  const currentSupplier = showInvites ? suppliers.find((supplier) => supplier.id === showInvites) : null;

  const statusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "default";
      case "sent":
        return "secondary";
      case "pending":
        return "outline";
      case "expired":
        return "destructive";
      default:
        return "outline";
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openCatalog()} disabled={!activeShopId}>
            <ShoppingCart className="w-4 h-4 mr-2" />
            {t("openCatalog")}
          </Button>
          <Button onClick={() => setShowNewSupplier(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t("newSupplier")}
          </Button>
        </div>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/20">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit">{t("readyToBuy")}</Badge>
            <h2 className="text-xl font-semibold text-foreground">{t("readyToBuy")}</h2>
            <p className="text-sm text-muted-foreground max-w-3xl">{t("readyToBuyDesc")}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{t("buyFlow1")}</Badge>
            <Badge variant="outline">{t("buyFlow2")}</Badge>
            <Badge variant="outline">{t("buyFlow3")}</Badge>
            <Badge variant="outline">{t("buyFlow4")}</Badge>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-muted-foreground">
              {activeShopId
                ? `${t("activeShop")}: ${activeShop?.name || "—"}`
                : t("selectShop")}
            </p>
            <Button onClick={() => openCatalog()} disabled={!activeShopId}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t("openCatalog")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{suppliers.length}</p>
              <p className="text-xs text-muted-foreground">{t("totalSuppliers")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/50">
              <Package className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{supplierParts.length}</p>
              <p className="text-xs text-muted-foreground">{t("partsCatalog")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <ShoppingCart className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{supplierParts.filter((part) => part.stock_available > 0).length}</p>
              <p className="text-xs text-muted-foreground">{t("partsReady")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <CheckCircle2 className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalAccepted}</p>
              <p className="text-xs text-muted-foreground">{t("accepted")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">{t("noSuppliers")}</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {suppliers.map((supplier) => {
            const supplierInvites = invites.filter((invite) => invite.supplier_id === supplier.id);
            const supplierAccepted = supplierInvites.filter((invite) => invite.status === "accepted").length;
            const supplierCatalogCount = partsBySupplier[supplier.id] || 0;
            const supplierInStockCount = inStockBySupplier[supplier.id] || 0;

            return (
              <Card key={supplier.id}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{supplier.name}</h3>
                        <Badge variant={supplierInStockCount > 0 ? "default" : "outline"}>
                          {supplierInStockCount > 0 ? t("readyToBuy") : t("partsCatalog")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground break-all">{supplier.contact_email}</p>
                      <p className="text-sm text-muted-foreground">{supplier.contact_phone || "—"}</p>
                    </div>
                    <Badge variant="outline" className="gap-1 shrink-0">
                      <Percent className="w-3 h-3" />
                      {supplier.discount_percent}%
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-lg font-bold text-foreground">{supplierCatalogCount}</p>
                      <p className="text-xs text-muted-foreground">{t("catalogItems")}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-lg font-bold text-foreground">{supplierInStockCount}</p>
                      <p className="text-xs text-muted-foreground">{t("inStock")}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-lg font-bold text-foreground">{supplierInvites.length}</p>
                      <p className="text-xs text-muted-foreground">{t("viewInvites")}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-lg font-bold text-foreground">{supplierAccepted}</p>
                      <p className="text-xs text-muted-foreground">{t("accepted")}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => openCatalog(supplier.id)} disabled={!activeShopId || supplierCatalogCount === 0}>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {t("buyFromSupplier")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowInvites(supplier.id)}>
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      {t("viewInvites")}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteSupplier(supplier.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {suppliers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("supplierManagement")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("phone")}</TableHead>
                  <TableHead>{t("discount")}</TableHead>
                  <TableHead className="text-center">{t("partsCatalog")}</TableHead>
                  <TableHead className="text-center">{t("partsReady")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.contact_email}</TableCell>
                    <TableCell>{supplier.contact_phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Percent className="w-3 h-3" />
                        {supplier.discount_percent}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{partsBySupplier[supplier.id] || 0}</TableCell>
                    <TableCell className="text-center">{inStockBySupplier[supplier.id] || 0}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" onClick={() => openCatalog(supplier.id)} disabled={!activeShopId || (partsBySupplier[supplier.id] || 0) === 0}>
                          <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                          {t("openCatalog")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowInvites(supplier.id)}>
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          {t("viewInvites")}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteSupplier(supplier.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showNewSupplier} onOpenChange={setShowNewSupplier}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newSupplier")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("name")}</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div>
              <Label>{t("email")}</Label>
              <Input type="email" value={form.contact_email} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} />
            </div>
            <div>
              <Label>{t("phone")}</Label>
              <Input value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} />
            </div>
            <div>
              <Label>{t("discount")}</Label>
              <Input type="number" value={form.discount_percent} onChange={(event) => setForm({ ...form, discount_percent: event.target.value })} />
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSupplier(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={createSupplier}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showInvites} onOpenChange={(open) => !open && setShowInvites(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("invitesFor")} {currentSupplier?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={() => setShowNewInvite(true)}>
              <Plus className="w-4 h-4 mr-1" />
              {t("sendInvite")}
            </Button>
          </div>
          {currentInvites.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{t("noInvitesSent")}</p>
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
                {currentInvites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.shop_name || "-"}</TableCell>
                    <TableCell>{invite.shop_email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invite.plan_offer}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor(invite.status)}>{invite.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {(invite.status === "pending" || invite.status === "sent") && (
                        <Button size="sm" variant="outline" onClick={() => sendInvite(invite.id)}>
                          <RotateCw className="w-3.5 h-3.5 mr-1" />
                          {invite.status === "pending" ? t("sendInvite") : t("resend")}
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

      <Dialog open={showNewInvite} onOpenChange={setShowNewInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sendInvite")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("shopName")}</Label>
              <Input value={inviteForm.shop_name} onChange={(event) => setInviteForm({ ...inviteForm, shop_name: event.target.value })} />
            </div>
            <div>
              <Label>{t("email")}</Label>
              <Input type="email" value={inviteForm.shop_email} onChange={(event) => setInviteForm({ ...inviteForm, shop_email: event.target.value })} />
            </div>
            <div>
              <Label>{t("phone")}</Label>
              <Input value={inviteForm.shop_phone} onChange={(event) => setInviteForm({ ...inviteForm, shop_phone: event.target.value })} />
            </div>
            <div>
              <Label>{t("plan")}</Label>
              <Select value={inviteForm.plan_offer} onValueChange={(value) => setInviteForm({ ...inviteForm, plan_offer: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="garage">Garage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("trialDays")}</Label>
              <Input type="number" value={inviteForm.trial_days} onChange={(event) => setInviteForm({ ...inviteForm, trial_days: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewInvite(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={createInvite}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeShopId && (
        <SupplierPartsSearch
          open={catalogOpen}
          onClose={() => {
            setCatalogOpen(false);
            setCatalogSupplierId(null);
          }}
          shopId={activeShopId}
          defaultSupplierId={catalogSupplierId || undefined}
        />
      )}
    </div>
  );
}
