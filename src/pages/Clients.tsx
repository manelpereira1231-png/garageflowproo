import { useState, useEffect, useCallback } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Phone, Mail, Building2, Pencil, Trash2, Link2, MessageCircle, X } from "lucide-react";
import { useTableState } from "@/hooks/useTableState";
import { SortableHeader } from "@/components/table/SortableHeader";
import { TablePagination } from "@/components/table/TablePagination";
import { toast } from "sonner";
import { toastError } from "@/lib/errorMessages";
import { useLanguage } from "@/i18n/LanguageContext";
import { openWhatsApp } from "@/lib/whatsapp";
import ListSkeleton from "@/components/ListSkeleton";
import { pageCache } from "@/lib/pageCache";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { sendLifecycleEmail } from "@/lib/lifecycleEmail";

const sendWhatsAppHello = (client: { phone: string; name: string }) => {
  if (!client.phone) {
    toast.error("Cliente sem telefone");
    return;
  }
  const ok = openWhatsApp({
    phone: client.phone,
    clientName: client.name,
    type: "client",
  });
  if (!ok) toast.error("Não foi possível abrir o WhatsApp");
};

interface ClientRow {
  id: string; name: string; phone: string; email: string;
  company: string | null; nif: string | null; notes: string | null; created_at: string;
  is_fleet?: boolean | null; fleet_name?: string | null; fleet_manager?: string | null;
  portal_token: string | null;
}

const PAGE_SIZE = 50;
const FETCH_LIMIT = 2000;
type ClientsFilters = { search: string };
const defaultClientsFilters: ClientsFilters = { search: "" };

const copyPortalLink = async (clientId: string, portalToken: string | null, successMsg: string) => {
  try {
    let token = portalToken;
    if (!token) {
      // Cliente antigo sem token — gera um agora para o botão nunca ficar "morto".
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from("clients")
        .update({ portal_token: newToken })
        .eq("id", clientId);
      if (error) throw error;
      token = newToken;
    }
    const url = `${window.location.origin}/portal/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(successMsg, { description: url });
    } catch {
      // Clipboard bloqueado (contexto não seguro / permissões): abre o portal.
      window.open(url, "_blank", "noopener");
      toast.success("Portal do cliente aberto numa nova janela");
    }
  } catch (e: any) {
    toast.error(e?.message || "Não foi possível gerar o link do portal");
  }
};


export default function Clients() {
  const { t } = useLanguage();
  const activeShopIdInit = (typeof window !== "undefined" ? localStorage.getItem("garageflow_active_shop") : null);
  const cacheKey = `clients-all:${activeShopIdInit}`;
  const cached = pageCache.get<{ rows: ClientRow[] }>(cacheKey);
  const [clients, setClients] = useState<ClientRow[]>(cached?.rows ?? []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(!cached);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "", nif: "", notes: "", is_fleet: false, fleet_name: "", fleet_manager: "" });

  const resetForm = () => setForm({ name: "", phone: "", email: "", company: "", nif: "", notes: "", is_fleet: false, fleet_name: "", fleet_manager: "" });

  const activeShopId = useActiveShopId();

  const getActiveShopId = (): string | null => activeShopId;

  const table = useTableState<ClientsFilters>({
    storageKey: "table:clients",
    defaultFilters: defaultClientsFilters,
    defaultSort: { key: "created_at", dir: "desc" },
    pageSize: PAGE_SIZE,
  });
  const { filters, updateFilter, clearFilters, hasActiveFilters, sort, toggleSort, page, setPage, apply } = table;
  const search = filters.search;

  const fetchClients = async () => {
    const shopId = getActiveShopId();
    if (!shopId) { setDataLoading(false); return; }
    const key = `clients-all:${shopId}`;
    const c = pageCache.get<{ rows: ClientRow[] }>(key);
    if (c) { setClients(c.rows); setDataLoading(false); }
    else { setDataLoading(true); }
    try {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("shop_id", shopId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(FETCH_LIMIT);
      if (data) setClients(data);
      pageCache.set(key, { rows: data ?? [] });
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, [activeShopId]);

  // Realtime: any INSERT/UPDATE/DELETE on this shop's clients → refetch.
  useRealtimeTable("clients", { shopId: activeShopId, onChange: fetchClients });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const shopId = getActiveShopId();
    if (!shopId) { toast.error(t('common.configureShop')); setLoading(false); return; }

    const payload = {
      shop_id: shopId, name: form.name, phone: form.phone, email: form.email,
      company: form.company || null, nif: form.nif || null, notes: form.notes || null,
      is_fleet: !!form.is_fleet, fleet_name: form.is_fleet ? (form.fleet_name || null) : null,
      fleet_manager: form.is_fleet ? (form.fleet_manager || null) : null,
    };

    const result = editingId
      ? await supabase.from("clients").update(payload).eq("id", editingId).select("id").single()
      : await supabase.from("clients").insert(payload).select("id").single();
    const { error } = result;

    if (error) toastError(error, editingId ? "Não foi possível atualizar o cliente" : "Não foi possível criar o cliente");
    else {
      if (!editingId && form.email && result.data?.id) {
        void sendLifecycleEmail({
          shopId, templateKey: "welcome", entityId: result.data.id, recipient: form.email,
          data: { client_name: form.name },
        });
      }
      toast.success(editingId ? t('clients.updated') : t('clients.created'));
      setOpen(false);
      setEditingId(null);
      resetForm();
      setPage(0);
      fetchClients();
    }
    setLoading(false);
  };

  const openEdit = (c: ClientRow) => {
    setEditingId(c.id);
    setForm({ name: c.name, phone: c.phone, email: c.email, company: c.company || "", nif: c.nif || "", notes: c.notes || "", is_fleet: !!c.is_fleet, fleet_name: c.fleet_name || "", fleet_manager: c.fleet_manager || "" });
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", deleteId);
    if (error) toastError(error, "Não foi possível eliminar o cliente");
    else { toast.success(t('clients.deleted')); fetchClients(); }
    setDeleteId(null);
  };

  const preFiltered = clients.filter((c) => {
    const s = filters.search.toLowerCase();
    if (!s) return true;
    return (
      c.name.toLowerCase().includes(s) ||
      (c.email || "").toLowerCase().includes(s) ||
      (c.phone || "").toLowerCase().includes(s) ||
      (c.nif || "").toLowerCase().includes(s) ||
      (c.company || "").toLowerCase().includes(s)
    );
  });
  const view = apply(preFiltered, {
    name: (c) => c.name,
    email: (c) => c.email || "",
    company: (c) => c.company || "",
    nif: (c) => c.nif || "",
    created_at: (c) => new Date(c.created_at).getTime(),
  });
  const filtered = view.rows;
  const totalCount = clients.length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('clients.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{totalCount} {t('clients.title').toLowerCase()}</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" />{t('clients.new')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader><DialogTitle>{editingId ? t('common.edit') : t('clients.new')}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t('clients.name')} *</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('clients.phone')}</Label>
                  <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('clients.email')}</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('clients.company')}</Label>
                  <Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('clients.nif')}</Label>
                  <Input value={form.nif} onChange={e => setForm({...form, nif: e.target.value})} />
                </div>
              </div>
              <div className="rounded-lg border border-border p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={form.is_fleet}
                    onChange={e => setForm({ ...form, is_fleet: e.target.checked })}
                  />
                  Cliente de frota (empresa com vários veículos)
                </label>
                {form.is_fleet && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Nome da frota</Label>
                      <Input value={form.fleet_name} onChange={e => setForm({ ...form, fleet_name: e.target.value })} placeholder="Ex.: Frota Norte" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Responsável da frota</Label>
                      <Input value={form.fleet_manager} onChange={e => setForm({ ...form, fleet_manager: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t('clients.notes')}</Label>
                <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('clients.creating') : (editingId ? t('common.save') : t('clients.create'))}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('clients.search')} value={search} onChange={e => updateFilter('search', e.target.value)} className="pl-9" />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} title="Limpar filtros"><X className="w-4 h-4" /></Button>
        )}
      </div>

      {/* Empty state CTA */}
      {dataLoading && clients.length === 0 && (
        <ListSkeleton rows={5} />
      )}

      {!dataLoading && totalCount === 0 && (
        <div className="text-center py-10 sm:py-14 bg-card border-2 border-dashed border-primary/20 rounded-2xl mb-4">
          <span className="text-4xl sm:text-5xl block mb-3">👤</span>
          <h3 className="text-lg font-bold mb-1">{t('clients.empty') || 'Ainda sem clientes'}</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
            {'Crie o seu primeiro cliente para começar a usar o sistema'}
          </p>
          <Button size="lg" onClick={() => setOpen(true)} className="px-6">
            <Plus className="w-4 h-4 mr-2" />{t('clients.new')}
          </Button>
        </div>
      )}

      {/* Mobile: Card view */}
      <div className="sm:hidden space-y-2">
        {totalCount > 0 && filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm bg-card border border-border rounded-xl p-5">
            {t('clients.noResults')}
          </div>
        ) : filtered.map(client => (
          <div key={client.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{client.name}</span>
              <div className="flex gap-1">
                {client.phone && (
                  <Button variant="ghost" size="sm" onClick={() => sendWhatsAppHello(client)} className="h-11 w-11 p-0 text-green-600 dark:text-green-500" title="WhatsApp"><MessageCircle className="w-5 h-5" /></Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => copyPortalLink(client.id, client.portal_token, t('common.copied'))} className="h-11 w-11 p-0" title="Portal"><Link2 className="w-4 h-4 text-primary" /></Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(client)} className="h-11 w-11 p-0"><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteId(client.id)} className="h-11 w-11 p-0 text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>}
              {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>}
              {client.company && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{client.company}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table view */}
      {totalCount > 0 && (
      <div className="hidden sm:block bg-card border border-border rounded-xl overflow-hidden sticky-thead">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader sortKey="name" currentSort={sort} onToggle={toggleSort}>{t('clients.name')}</SortableHeader>
              <SortableHeader sortKey="email" currentSort={sort} onToggle={toggleSort}>{t('clients.contact')}</SortableHeader>
              <SortableHeader sortKey="company" currentSort={sort} onToggle={toggleSort}>{t('clients.company')}</SortableHeader>
              <SortableHeader sortKey="nif" currentSort={sort} onToggle={toggleSort}>{t('clients.nif')}</SortableHeader>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {t('clients.noResults')}
                </TableCell>
              </TableRow>
            ) : filtered.map(client => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5 text-sm">
                    {client.phone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-muted-foreground" />{client.phone}</span>}
                    {client.email && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-muted-foreground" />{client.email}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {client.company && <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3 text-muted-foreground" />{client.company}</span>}
                </TableCell>
                <TableCell className="mono text-sm">{client.nif || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {client.phone && (
                      <Button variant="ghost" size="sm" onClick={() => sendWhatsAppHello(client)} className="text-xs text-green-600 dark:text-green-500" title="WhatsApp">
                        <MessageCircle className="w-3.5 h-3.5 mr-1" />WhatsApp
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => copyPortalLink(client.id, client.portal_token, t('common.copied'))} className="text-xs text-primary" title="Portal">
                      <Link2 className="w-3.5 h-3.5 mr-1" />{t('common.portal')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(client)} className="text-xs">
                      <Pencil className="w-3.5 h-3.5 mr-1" />{t('common.edit')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(client.id)} className="text-xs text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}

      <TablePagination page={view.page} totalPages={view.totalPages} total={view.total} pageSize={view.pageSize} start={view.start} onPageChange={setPage} labelOf={t('common.of') || 'de'} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('clients.deleteWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
