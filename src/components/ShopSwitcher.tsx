import { Building2, ChevronDown, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

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
}

export default function ShopSwitcher({ shops, activeShopId, onSwitch, onCreateNew, showCreate }: ShopSwitcherProps) {
  const { t } = useLanguage();

  if (shops.length <= 1 && !showCreate) return null;

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
        {showCreate && onCreateNew && (
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onCreateNew} title={t('shop.createNew')}>
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
