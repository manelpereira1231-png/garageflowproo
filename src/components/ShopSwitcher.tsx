import { useEffect, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { setActiveShopAndSync, clearActiveShopAndSync } from "@/lib/shopContextSync";
import { toast } from "sonner";

interface Shop {
  id: string;
  name: string;
  logo_url: string | null;
}

interface ShopSwitcherProps {
  shops: Shop[];
  activeShopId: string | null;
  onSwitch: (id: string) => void;
  onCreateNew?: () => void;
  showCreate?: boolean;
  onShopCreated?: () => void;
}

export default function ShopSwitcher({ shops, activeShopId, onSwitch, showCreate, onShopCreated }: ShopSwitcherProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Shop | null>(null);
  const [newShopName, setNewShopName] = useState("");
  const [newShopEmail, setNewShopEmail] = useState("");
  const [status, setStatus] = useState<{ allowed: boolean; current: number; max: number; plan: string } | null>(null);

  // The oldest owned shop = "Oficina Mãe". It is undeletable.
  // `shops` is already sorted by useShopContext but we defensively pick by
  // relying on the order the caller provides (mother-first when owned only).
  // We compute a primary flag using the smallest position — the server also
  // enforces this via `enforce_primary_shop_undeletable` trigger.
  const primaryShopId = shops[0]?.id ?? null;

  useEffect(() => {
    if (!showCreate) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase.rpc('get_shop_creation_status', { _user_id: user.id });
      if (cancelled || !data) return;
      setStatus(data as any);
    })();
    return () => { cancelled = true; };
  }, [showCreate, shops.length]);

  if (shops.length <= 1 && !showCreate) return null;

  const atLimit = status ? !status.allowed : false;
  const limitMsg = status && status.max > 0
    ? `Já atingiu o limite máximo de ${status.max} oficinas permitido pelo seu plano. Para adicionar mais será necessário um plano superior.`
    : t('shops.limitReached');

  const refreshStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.rpc('get_shop_creation_status', { _user_id: user.id });
    if (data) setStatus(data as any);
  };

  const handleCreateShop = async () => {
    if (!newShopName.trim()) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error(t('common.sessionExpired')); return; }

      const { data: canCreate, error: limitError } = await supabase.rpc('check_shop_creation_limit', { _user_id: user.id });
      if (limitError) { toast.error(limitError.message); return; }
      if (!canCreate) { toast.error(limitMsg); return; }

      const { data: shop, error } = await supabase.from("shops").insert({
        user_id: user.id,
        name: newShopName.trim(),
        email: newShopEmail.trim() || user.email || "",
      }).select().single();

      if (error) {
        if (error.message?.includes('SHOP_LIMIT_REACHED')) toast.error(limitMsg);
        else toast.error(error.message);
        return;
      }

      toast.success(`${newShopName.trim()} criada com sucesso!`);
      setNewShopName("");
      setNewShopEmail("");
      setOpen(false);

      if (shop) {
        onSwitch(shop.id);
        // Official primitive: single ordered write + broadcast.
        await setActiveShopAndSync(shop.id, { reason: "created" });
      }
      onShopCreated?.();

    } finally {
      setCreating(false);
    }
  };

  const handleDeleteShop = async (shop: Shop) => {
    setDeletingId(shop.id);
    try {
      const { data, error } = await supabase.rpc('delete_child_shop', { _shop_id: shop.id });
      if (error) {
        if (error.message?.includes('PRIMARY_SHOP_UNDELETABLE')) {
          toast.error("A Oficina Mãe não pode ser eliminada.");
        } else if (error.message?.includes('NOT_SHOP_OWNER')) {
          toast.error("Sem permissão para eliminar esta oficina.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success(`Oficina "${shop.name || 'sem nome'}" eliminada. Vaga libertada.`);
      // Official primitive: broadcasts deletion to every live useShopContext
      // instance. The Realtime DELETE listener fires too — the broadcast just
      // makes the UI feel instantaneous on the same tab.
      await clearActiveShopAndSync({ deletedShopId: shop.id, reason: "deleted" });

      setConfirmDelete(null);
      onShopCreated?.(); // reuses the same reload path
      await refreshStatus();
    } finally {
      setDeletingId(null);
    }
  };

  const deletableShops = shops.filter(s => s.id !== primaryShopId);

  return (
    <div className="px-3 pb-2">
      <div className="flex items-center gap-2 px-1 py-1.5">
        <Building2 className="w-4 h-4 text-sidebar-foreground flex-shrink-0" />
        <Select value={activeShopId || ""} onValueChange={onSwitch}>
          <SelectTrigger className="h-8 bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs flex-1">
            <SelectValue placeholder={t('shop.select')} />
          </SelectTrigger>
          <SelectContent>
            {shops.map(shop => (
              <SelectItem key={shop.id} value={shop.id}>
                <div className="flex items-center gap-2">
                  {shop.logo_url ? (
                    <img src={shop.logo_url} alt="" className="w-4 h-4 rounded object-contain" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span className="truncate">{shop.name || t('shop.unnamed')}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showCreate && deletableShops.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            title="Gerir oficinas"
            onClick={() => setManageOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        {showCreate && !atLimit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" title={t('shop.createNew')}>
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>{t('shop.createNew')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>{t('settings.shopName')} *</Label>
                  <Input value={newShopName} onChange={e => setNewShopName(e.target.value)} placeholder="Ex: Oficina Norte" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings.email')}</Label>
                  <Input type="email" value={newShopEmail} onChange={e => setNewShopEmail(e.target.value)} placeholder="oficina@exemplo.com" />
                </div>
                <Button onClick={handleCreateShop} disabled={!newShopName.trim() || creating} className="w-full">
                  {creating ? t('common.loading') : t('shop.createNew')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {showCreate && atLimit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 opacity-40 cursor-not-allowed"
            title={limitMsg}
            onClick={() => toast.error(limitMsg)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Gerir oficinas — só aparece para a Oficina Mãe */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Gerir Oficinas</DialogTitle>
            <DialogDescription>
              A Oficina Mãe não pode ser eliminada. Apenas as Oficinas Filhas podem ser removidas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2 max-h-[60vh] overflow-auto">
            {shops.map((s) => {
              const isPrimary = s.id === primaryShopId;
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.logo_url
                      ? <img src={s.logo_url} alt="" className="w-5 h-5 rounded object-contain" />
                      : <Building2 className="w-4 h-4 text-muted-foreground" />}
                    <span className="truncate text-sm">{s.name || t('shop.unnamed')}</span>
                    {isPrimary && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        Oficina Mãe
                      </span>
                    )}
                  </div>
                  {!isPrimary && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      disabled={deletingId === s.id}
                      onClick={() => setConfirmDelete(s)}
                      title="Eliminar oficina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar oficina "{confirmDelete?.name || 'sem nome'}"?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p><strong>Esta ação é irreversível.</strong></p>
                <p>Vai eliminar permanentemente desta oficina:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>clientes, veículos, orçamentos e ordens de serviço</li>
                  <li>faturas, pagamentos, stock e movimentos</li>
                  <li>utilizadores associados exclusivamente a esta oficina</li>
                  <li>automações, mensagens e notificações da oficina</li>
                </ul>
                <p>Após eliminar, a vaga fica <strong>imediatamente disponível</strong> no seu plano.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!deletingId}
              onClick={(e) => { e.preventDefault(); if (confirmDelete) handleDeleteShop(confirmDelete); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? "A eliminar..." : "Eliminar definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
