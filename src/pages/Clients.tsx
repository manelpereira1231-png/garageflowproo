import { useNavigate, useSearchParams } from "react-router-dom";
import { InsurerPicker, resolveInsurerId, type InsurerSelection } from "@/components/InsurerPicker";
import { useState, useEffect, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ClaimsHistory from "@/components/ClaimsHistory";
import { ShieldAlert } from "lucide-react";
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
import { useUrlSearchFilter } from "@/hooks/useUrlSearchFilter";
import { SortableHeader } from "@/components/table/SortableHeader";
import { TablePagination } from "@/components/table/TablePagination";
import { toast } from "sonner";
import { toastError } from "@/lib/errorMessages";
import { useLanguage } from "@/i18n/LanguageContext";
import { openWhatsApp } from "@/lib/whatsapp";
import ListSkeleton from "@/components/ListSkeleton";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useServerList } from "@/hooks/useServerList";

import { sendLifecycleEmail } from "@/lib/lifecycleEmail";
import { useShopCountry } from "@/hooks/useShopCountry";
import { getCountryFiscalConfig, getTaxIdLabel } from "@/lib/countryFields";
import { isValidTaxId, taxIdHint } from "@/lib/taxIdValidation";


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

/** Número em formato internacional para links `tel:` (assume +351 quando não há indicativo). */
const telHref = (phone: string) => {
  let cleaned = (phone || "").replace(/[^0-9+]/g, "");
  if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2);
  if (!cleaned.startsWith("+")) cleaned = (cleaned.startsWith("351") ? "+" : "+351") + cleaned;
  return `tel:${cleaned}`;
};

const callClient = (phone: string) => { window.location.href = telHref(phone); };
const emailClient = (email: string) => { window.location.href = `mailto:${email}`; };

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
  const { code: shopCountry } = useShopCountry();
  const taxIdField = getCountryFiscalConfig(shopCountry).fields.find((f) => f.key === "taxId");
  const taxIdLabel = getTaxIdLabel(shopCountry);
  const validateTaxId = (value: string) => isValidTaxId(value, shopCountry, taxIdField?.pattern);
  const taxIdHelp = taxIdHint(shopCountry) ?? taxIdField?.placeholder;

  const activeShopId = useActiveShopId();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [claimsClient, setClaimsClient] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<{ client: ClientRow; reasons: string[] }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const EMPTY_FORM = { name: "", phone: "", email: "", company: "", nif: "", notes: "", is_fleet: false, fleet_name: "", fleet_manager: "", is_insurance: false, insurer_id: "", ins_policy: "", ins_claim: "", ins_date: "", ins_notes: "" };
  const [form, setForm] = useState(EMPTY_FORM);
  const [insSel, setInsSel] = useState<InsurerSelection>(null);
  const [claimPrompt, setClaimPrompt] = useState<string | null>(null);
  const [urlParams] = useSearchParams();
  const navigate = useNavigate();
  const returnToClaims = urlParams.get("return") === "claims";
  // Aberto a partir de "Novo sinistro → Criar novo cliente"
  useEffect(() => {
    if (urlParams.get("new") === "1") {
      setEditingId(null);
      setForm({ ...EMPTY_FORM, is_insurance: urlParams.get("insurance") === "1" });
      setInsSel(null);
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => setForm(EMPTY_FORM);


  const getActiveShopId = (): string | null => activeShopId;

  const table = useTableState<ClientsFilters>({
    storageKey: "table:clients",
    defaultFilters: defaultClientsFilters,
    defaultSort: { key: "created_at", dir: "desc" },
    pageSize: PAGE_SIZE,
  });
  const { filters, updateFilter, clearFilters, hasActiveFilters, sort, toggleSort, page, setPage } = table;
  const search = filters.search;
  // Alertas/notificações abrem esta lista já pesquisada (?search=...)
  useUrlSearchFilter((v) => updateFilter("search", v));

  // Server-side sort: the table header keys map 1:1 to real columns.
  const SORT_COLUMNS: Record<string, string> = {
    name: "name", email: "email", company: "company", nif: "nif", created_at: "created_at",
  };
  const orderBy = (sort.key && SORT_COLUMNS[sort.key]) || "created_at";
  const ascending = sort.key && sort.dir ? sort.dir === "asc" : false;

  const {
    rows: clients,
    total: totalCount,
    loading: dataLoading,
    refetch: fetchClients,
  } = useServerList<ClientRow>({
    table: "clients",
    shopId: activeShopId,
    select: "*",
    page,
    pageSize: PAGE_SIZE,
    orderBy,
    ascending,
    search,
    searchColumns: ["name", "email", "phone", "nif", "company"],
    notDeleted: true,
    refreshKey,
  });

  const filtered = clients;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  // Realtime: any INSERT/UPDATE/DELETE on this shop's clients → refetch.
  useRealtimeTable("clients", { shopId: activeShopId, onChange: () => setRefreshKey((k) => k + 1) });

  // Duplicate detection now runs on the server (the browser only holds one page).
  const findDuplicates = async (): Promise<{ client: ClientRow; reasons: string[] }[]> => {
    const shopId = getActiveShopId();
    if (!shopId) return [];
    const nif = (form.nif || "").trim();
    const email = (form.email || "").trim();
    const phone = (form.phone || "").trim();
    const ors: string[] = [];
    if (nif) ors.push(`nif.ilike.${nif}`);
    if (email) ors.push(`email.ilike.${email}`);
    if (phone) ors.push(`phone.ilike.${phone}`);
    if (ors.length === 0) return [];
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("shop_id", shopId)
      .is("deleted_at", null)
      .or(ors.join(","))
      .limit(5);
    return (data || [])
      .filter((c: any) => c.id !== editingId)
      .map((c: any) => {
        const reasons: string[] = [];
        if (nif && (c.nif || "").trim().toLowerCase() === nif.toLowerCase()) reasons.push(taxIdLabel);
        if (email && (c.email || "").trim().toLowerCase() === email.toLowerCase()) reasons.push("Email");
        if (phone && (c.phone || "").trim() === phone) reasons.push("Telefone");
        return { client: c as ClientRow, reasons };
      })
      .filter((d) => d.reasons.length > 0);
  };


  const persistClient = async () => {
    setLoading(true);
    const shopId = getActiveShopId();
    if (!shopId) { toast.error(t('common.configureShop')); setLoading(false); return; }

    const payload: any = {
      shop_id: shopId, name: form.name, phone: form.phone, email: form.email,
      company: form.company || null, nif: form.nif || null, notes: form.notes || null,

      is_fleet: !!form.is_fleet, fleet_name: form.is_fleet ? (form.fleet_name || null) : null,
      fleet_manager: form.is_fleet ? (form.fleet_manager || null) : null,
      is_insurance: !!form.is_insurance, insurer_id: null as string | null,
      insurance_meta: form.is_insurance ? {
        policy_number: form.ins_policy || null, claim_number: form.ins_claim || null,
        claim_date: form.ins_date || null, notes: form.ins_notes || null,
      } : {},
    };
    if (form.is_insurance) {
      try { payload.insurer_id = await resolveInsurerId(shopId, insSel); }
      catch { toast.error("Não foi possível guardar a seguradora"); setLoading(false); return; }
    }

    const result = editingId
      ? await supabase.from("clients").update(payload).eq("id", editingId).eq("shop_id", activeShopId).select("id").single()
      : await supabase.from("clients").insert(payload).select("id").single();
    const { error } = result;

    if (error) {
      // Proteção de duplicados na base de dados (índices únicos por oficina).
      if ((error as any).code === "23505") {
        const msg = (error as any).message || "";
        const campo = msg.includes("nif") ? taxIdLabel : msg.includes("email") ? "email" : msg.includes("phone") ? "telefone" : "identificador";
        toast.error("Cliente já existe", { description: `Já existe um cliente nesta oficina com o mesmo ${campo}.` });
        fetchClients();
      } else {
        toastError(error, editingId ? "Não foi possível atualizar o cliente" : "Não foi possível criar o cliente");
      }
    }

    else {
      if (!editingId && form.email && result.data?.id) {
        void sendLifecycleEmail({
          shopId, templateKey: "welcome", entityId: result.data.id, recipient: form.email,
          data: { client_name: form.name },
        });
      }
      toast.success(editingId ? t('clients.updated') : t('clients.created'));
      const newId = result.data?.id;
      if (form.is_insurance && newId) {
        // Cliente de seguradora entra logo nos Sinistros (cria processo se ainda não tiver).
        const { count } = await supabase.from("claims").select("id", { count: "exact", head: true })
          .eq("shop_id", shopId).eq("client_id", newId);
        if (!count) {
          const { error: cErr } = await supabase.from("claims").insert({
            shop_id: shopId, client_id: newId, insurer_id: payload.insurer_id,
            claim_number: form.ins_claim || null, policy_number: form.ins_policy || null,
            claim_date: form.ins_date || null, notes: form.ins_notes || null, status: "new",
          } as any);
          if (cErr) toastError(cErr, "Cliente guardado, mas não foi possível criar o sinistro");
          else toast.success("Sinistro criado em Sinistros");
        }
      }
      setOpen(false);
      setEditingId(null);
      resetForm();
      setPage(0);
      fetchClients();
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const shopId = getActiveShopId();
    if (!shopId) { toast.error(t('common.configureShop')); return; }
    if (!validateTaxId(form.nif)) {
      toast.error(`${taxIdLabel} inválido`, { description: taxIdHelp ? `Formato esperado: ${taxIdHelp}` : undefined });
      return;
    }


    const dups = await findDuplicates();
    if (dups.length > 0) {
      setDuplicates(dups);
      return;
    }
    await persistClient();
  };



  const openEdit = (c: ClientRow) => {
    setEditingId(c.id);
    setForm({ name: c.name, phone: c.phone, email: c.email, company: c.company || "", nif: c.nif || "", notes: c.notes || "", is_fleet: !!c.is_fleet, fleet_name: c.fleet_name || "", fleet_manager: c.fleet_manager || "", is_insurance: !!(c as any).is_insurance, insurer_id: (c as any).insurer_id || "", ins_policy: (c as any).insurance_meta?.policy_number || "", ins_claim: (c as any).insurance_meta?.claim_number || "", ins_date: (c as any).insurance_meta?.claim_date || "", ins_notes: (c as any).insurance_meta?.notes || "" });
    setInsSel((c as any).insurer_id ? { insurerId: (c as any).insurer_id } : null);
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", deleteId);
    if (error) toastError(error, "Não foi possível eliminar o cliente");
    else { toast.success(t('clients.deleted')); fetchClients(); }
    setDeleteId(null);
  };

  // Filtering, sorting and paging all happen server-side (see useServerList).


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
                  <Label>{taxIdLabel}</Label>
                  <Input
                    value={form.nif}
                    inputMode={taxIdField?.pattern?.includes("\\d") ? "numeric" : undefined}
                    placeholder={taxIdField?.placeholder}
                    onChange={e => setForm({...form, nif: e.target.value})}
                    aria-invalid={!validateTaxId(form.nif)}
                    className={!validateTaxId(form.nif) ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                  {!validateTaxId(form.nif) && (
                    <p className="text-xs text-destructive">{taxIdLabel} inválido{taxIdHelp ? ` — ${taxIdHelp}` : ""}</p>
                  )}

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
              <div className="rounded-lg border border-border p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer min-h-[44px] sm:min-h-0">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={form.is_insurance}
                    onChange={e => setForm({ ...form, is_insurance: e.target.checked })}
                  />
                  Cliente de seguradora (processo de sinistro)
                </label>
                {form.is_insurance && (
                  <div className="space-y-2">
                    <InsurerPicker shopId={activeShopId} value={insSel} onChange={setInsSel} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1"><Label>Nº da apólice</Label><Input value={form.ins_policy} onChange={e => setForm({ ...form, ins_policy: e.target.value })} placeholder="Opcional" /></div>
                      <div className="space-y-1"><Label>Nº do sinistro/processo</Label><Input value={form.ins_claim} onChange={e => setForm({ ...form, ins_claim: e.target.value })} placeholder="Opcional" /></div>
                      <div className="space-y-1"><Label>Data do sinistro</Label><Input type="date" value={form.ins_date} onChange={e => setForm({ ...form, ins_date: e.target.value })} /></div>
                      <div className="space-y-1"><Label>Observações</Label><Input value={form.ins_notes} onChange={e => setForm({ ...form, ins_notes: e.target.value })} placeholder="Opcional" /></div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Tudo opcional. A seguradora de cada processo fica guardada no próprio sinistro.</p>
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

      {!dataLoading && totalCount === 0 && !search && (
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
      <div className="lg:hidden space-y-2">
        {totalCount > 0 && filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm bg-card border border-border rounded-xl p-5">
            {t('clients.noResults')}
          </div>
        ) : filtered.map(client => (
          <div key={client.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
             <div className="flex min-w-0 items-center gap-1 overflow-hidden sm:block sm:overflow-visible">
               <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug sm:block sm:whitespace-normal sm:break-words sm:text-base" title={client.name}>{client.name}</span>
              <div className="flex shrink-0 items-center sm:mt-3 sm:flex-wrap sm:justify-between sm:gap-1 sm:border-t sm:border-border/60 sm:pt-2">
                 {client.phone && (
                   <Button variant="ghost" size="sm" onClick={() => callClient(client.phone)} className="h-11 w-8 p-0 text-primary sm:w-11" title={`Ligar ${client.phone}`}><Phone className="w-5 h-5" /></Button>
                )}
                {client.phone && (
                   <Button variant="ghost" size="sm" onClick={() => sendWhatsAppHello(client)} className="h-11 w-8 p-0 text-green-600 dark:text-green-500 sm:w-11" title={`WhatsApp ${client.phone}`}><MessageCircle className="w-5 h-5" /></Button>
                )}

                {client.email && (
                   <Button variant="ghost" size="sm" onClick={() => emailClient(client.email)} className="h-11 w-8 p-0 sm:w-11" title="Email"><Mail className="w-5 h-5" /></Button>
                )}
                 <Button variant="ghost" size="sm" onClick={() => copyPortalLink(client.id, client.portal_token, t('common.copied'))} className="h-11 w-8 p-0 sm:w-11" title="Portal"><Link2 className="w-4 h-4 text-primary" /></Button>
                 {(client as any).is_insurance && <Button variant="ghost" size="sm" onClick={() => setClaimsClient(client)} className="h-11 w-8 p-0 sm:w-11" title="Sinistros"><ShieldAlert className="w-4 h-4 text-primary" /></Button>}
                 <Button variant="ghost" size="sm" onClick={() => openEdit(client)} className="h-11 w-8 p-0 sm:w-11"><Pencil className="w-4 h-4" /></Button>
                 <Button variant="ghost" size="sm" onClick={() => setDeleteId(client.id)} className="h-11 w-8 p-0 text-destructive sm:w-11"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
             <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs text-muted-foreground sm:flex sm:flex-wrap">
               {client.phone && <span className="flex min-w-0 items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{client.phone}</span>}

               {client.email && <span className="flex min-w-0 items-center gap-1"><Mail className="h-3 w-3 shrink-0" /><span className="truncate" title={client.email}>{client.email}</span></span>}
               {client.company && <span className="col-span-2 flex min-w-0 items-center gap-1 sm:col-auto"><Building2 className="h-3 w-3 shrink-0" /><span className="truncate" title={client.company}>{client.company}</span></span>}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table view */}
      {totalCount > 0 && (
      <div className="hidden lg:block bg-card border border-border rounded-xl overflow-hidden sticky-thead">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader sortKey="name" currentSort={sort} onToggle={toggleSort}>{t('clients.name')}</SortableHeader>
              <SortableHeader sortKey="email" currentSort={sort} onToggle={toggleSort}>{t('clients.contact')}</SortableHeader>
              <SortableHeader sortKey="company" currentSort={sort} onToggle={toggleSort}>{t('clients.company')}</SortableHeader>
              <SortableHeader sortKey="nif" currentSort={sort} onToggle={toggleSort}>{taxIdLabel}</SortableHeader>
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
                    {client.phone && <span className="flex items-center gap-1.5 whitespace-nowrap"><Phone className="w-3 h-3 text-muted-foreground" />{client.phone}</span>}

                    {client.email && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-muted-foreground" />{client.email}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {client.company && <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3 text-muted-foreground" />{client.company}</span>}
                </TableCell>
                <TableCell className="mono text-sm">{client.nif || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1 items-center">
                    {client.phone && (
                      <Button variant="ghost" size="sm" onClick={() => callClient(client.phone)} className="text-xs text-primary" title={`Ligar ${client.phone}`}>
                        <Phone className="w-3.5 h-3.5 mr-1" />Ligar
                      </Button>
                    )}
                    {client.email && (

                      <Button variant="ghost" size="sm" onClick={() => emailClient(client.email)} className="text-xs" title="Email">
                        <Mail className="w-3.5 h-3.5 mr-1" />Email
                      </Button>
                    )}
                    {client.phone ? (
                      <Button variant="ghost" size="sm" onClick={() => sendWhatsAppHello(client)} className="text-xs text-green-600 dark:text-green-500 w-[110px] justify-start" title="WhatsApp">
                        <MessageCircle className="w-3.5 h-3.5 mr-1" />WhatsApp
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground px-3 w-[110px] inline-flex items-center gap-1 whitespace-nowrap" title="Sem WhatsApp">
                        <MessageCircle className="w-3.5 h-3.5 opacity-40" />—
                      </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => copyPortalLink(client.id, client.portal_token, t('common.copied'))} className="text-xs text-primary" title="Portal">
                      <Link2 className="w-3.5 h-3.5 mr-1" />{t('common.portal')}
                    </Button>
                    {(client as any).is_insurance && (
                    <Button variant="ghost" size="sm" onClick={() => setClaimsClient(client)} className="text-xs" title="Sinistros">
                      <ShieldAlert className="w-3.5 h-3.5 mr-1" />Sinistros
                    </Button>
                    )}
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

      <TablePagination page={safePage} totalPages={totalPages} total={totalCount} pageSize={PAGE_SIZE} start={safePage * PAGE_SIZE} onPageChange={setPage} labelOf={t('common.of') || 'de'} />

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

      <AlertDialog open={duplicates.length > 0} onOpenChange={(o) => { if (!o) setDuplicates([]); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cliente possivelmente duplicado</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Já existem clientes com os mesmos dados nesta oficina:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {duplicates.slice(0, 5).map((d) => (
                    <li key={d.client.id}>
                      <span className="font-medium text-foreground">{d.client.name}</span>
                      {" — "}{d.reasons.join(", ")} igual
                    </li>
                  ))}
                </ul>
                <p>Pretende guardar mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { setDuplicates([]); await persistClient(); }}>Guardar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!claimsClient} onOpenChange={(o) => { if (!o) setClaimsClient(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Sinistros — {claimsClient?.name}</DialogTitle></DialogHeader>
          {claimsClient && <ClaimsHistory clientId={claimsClient.id} title="Processos de seguradoras" />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!claimPrompt} onOpenChange={(o) => { if (!o) setClaimPrompt(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>Cliente criado com sucesso</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cliente de seguradora. Para gerir a reparação associada, pode criar o processo de sinistro.</p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button className="flex-1 min-h-[44px]" onClick={() => { const id = claimPrompt; setClaimPrompt(null); navigate(`/claims?new=1&client=${id}`); }}>Criar sinistro agora</Button>
            <Button variant="outline" className="flex-1 min-h-[44px]" onClick={() => setClaimPrompt(null)}>Fazer mais tarde</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
