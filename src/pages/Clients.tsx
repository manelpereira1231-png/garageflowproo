import { useState, useEffect, useCallback } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Phone, Mail, Building2, ChevronLeft, ChevronRight, Pencil, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

interface ClientRow {
  id: string; name: string; phone: string; email: string;
  company: string | null; nif: string | null; notes: string | null; created_at: string;
  portal_token: string | null;
}

const PAGE_SIZE = 25;

const copyPortalLink = (portalToken: string | null, successMsg: string) => {
  if (!portalToken) return;
  const url = `${window.location.origin}/portal/${portalToken}`;
  navigator.clipboard.writeText(url);
  toast.success(successMsg);
};

export default function Clients() {
  const { t } = useLanguage();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "", nif: "", notes: "" });

  const resetForm = () => setForm({ name: "", phone: "", email: "", company: "", nif: "", notes: "" });

  const activeShopId = useActiveShopId();

  const getActiveShopId = (): string | null => activeShopId;

  const fetchClients = async () => {
    const shopId = getActiveShopId();
    if (!shopId) return;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await supabase
      .from("clients")
      .select("*", { count: "exact" })
      .eq("shop_id", shopId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data) setClients(data);
    if (count !== null) setTotalCount(count);
  };

  useEffect(() => { fetchClients(); }, [page, activeShopId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const shopId = getActiveShopId();
    if (!shopId) { toast.error(t('common.configureShop')); setLoading(false); return; }

    const payload = {
      shop_id: shopId, name: form.name, phone: form.phone, email: form.email,
      company: form.company || null, nif: form.nif || null, notes: form.notes || null,
    };

    const { error } = editingId
      ? await supabase.from("clients").update(payload).eq("id", editingId)
      : await supabase.from("clients").insert(payload);

    if (error) toast.error(error.message);
    else {
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
    setForm({ name: c.name, phone: c.phone, email: c.email, company: c.company || "", nif: c.nif || "", notes: c.notes || "" });
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success(t('clients.deleted')); fetchClients(); }
    setDeleteId(null);
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.nif && c.nif.includes(search))
  );

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('clients.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Empty state CTA */}
      {totalCount === 0 && (
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
                <Button variant="ghost" size="sm" onClick={() => copyPortalLink(client.portal_token, t('common.copied'))} className="h-7 w-7 p-0" title="Portal"><Link2 className="w-3.5 h-3.5 text-primary" /></Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(client)} className="h-7 w-7 p-0"><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteId(client.id)} className="h-7 w-7 p-0 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
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
      <div className="hidden sm:block bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('clients.name')}</TableHead>
              <TableHead>{t('clients.contact')}</TableHead>
              <TableHead>{t('clients.company')}</TableHead>
              <TableHead>{t('clients.nif')}</TableHead>
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
                    <Button variant="ghost" size="sm" onClick={() => copyPortalLink(client.portal_token, t('common.copied'))} className="text-xs text-primary" title="Portal">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} {t('common.of')} {totalCount}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

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
