import { useState } from "react";
import { Building2, ChevronDown, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
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
  const [creating, setCreating] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [newShopEmail, setNewShopEmail] = useState("");

  if (shops.length <= 1 && !showCreate) return null;

  const handleCreateShop = async () => {
    if (!newShopName.trim()) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error(t('common.sessionExpired')); return; }

      // Backend validation: check shop creation limit
      const { data: canCreate, error: limitError } = await supabase.rpc('check_shop_creation_limit', { _user_id: user.id });
      if (limitError) { toast.error(limitError.message); return; }
      if (!canCreate) {
        toast.error(t('shops.limitReached'));
        return;
      }

      const { data: shop, error } = await supabase.from("shops").insert({
        user_id: user.id,
        name: newShopName.trim(),
        email: newShopEmail.trim() || user.email || "",
      }).select().single();

      if (error) { toast.error(error.message); return; }
      
      toast.success(`${newShopName.trim()} criada com sucesso!`);
      setNewShopName("");
      setNewShopEmail("");
      setOpen(false);
      
      // Switch to new shop and reload
      if (shop) {
        onSwitch(shop.id);
        localStorage.setItem("garageflow_active_shop", shop.id);
      }
      onShopCreated?.();
    } finally {
      setCreating(false);
    }
  };

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
        {showCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="t(" className="h-8 w-8 flex-shrink-0" title={t('shop.createNew')}>
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
                  <Input
                    value={newShopName}
                    onChange={e => setNewShopName(e.target.value)}
                    placeholder="Ex: Oficina Norte"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings.email')}</Label>
                  <Input
                    type="email"
                    value={newShopEmail}
                    onChange={e => setNewShopEmail(e.target.value)}
                    placeholder="oficina@exemplo.com"
                  />
                </div>
                <Button
                  onClick={handleCreateShop}
                  disabled={!newShopName.trim() || creating}
                  className="w-full"
                >
                  {creating ? t('common.loading') : t('shop.createNew')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
