import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sliders, Star, Eye, EyeOff, Bell, BellOff } from "lucide-react";
import { useSidebarPrefs, isHideable, isNotifiable } from "@/hooks/useSidebarPrefs";

type Item = { path: string; label: string };

interface Props {
  shopId: string | null;
  items: Item[];
}

export default function SidebarCustomizer({ shopId, items }: Props) {
  const prefs = useSidebarPrefs(shopId);

  const hideableItems = items.filter(i => isHideable(i.path));
  const notifiableItems = items.filter(i => isNotifiable(i.path));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
          title="Personalizar sidebar"
        >
          <Sliders className="w-3.5 h-3.5 shrink-0" />
          <span>Personalizar</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sliders className="w-4 h-4" /> Personalizar sidebar</DialogTitle>
          <DialogDescription className="text-xs">
            Personalização leve. Os módulos principais nunca podem ser escondidos.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" /> Favoritos
          </h3>
          <p className="text-[11px] text-muted-foreground">Fixa itens no topo. Clica na estrela em qualquer item do menu.</p>
          {prefs.favorites.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sem favoritos. Passa o rato sobre um item do menu e clica na ⭐.</p>
          ) : (
            <ul className="space-y-1">
              {prefs.favorites.map((p, idx) => {
                const it = items.find(x => x.path === p);
                if (!it) return null;
                return (
                  <li key={p} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md bg-muted/40">
                    <span className="flex-1 truncate">{it.label}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0} onClick={() => prefs.moveFavorite(p, -1)}>↑</Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === prefs.favorites.length - 1} onClick={() => prefs.moveFavorite(p, 1)}>↓</Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => prefs.toggleFavorite(p)} title="Remover dos favoritos">
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-2 pt-2 border-t">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <EyeOff className="w-3.5 h-3.5" /> Esconder módulos secundários
          </h3>
          <p className="text-[11px] text-muted-foreground">Apenas módulos não-críticos podem ser escondidos.</p>
          <ul className="space-y-1">
            {hideableItems.map(it => {
              const hidden = prefs.isHidden(it.path);
              return (
                <li key={it.path} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/40">
                  <span className="text-sm flex items-center gap-2">
                    {hidden ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                    {it.label}
                  </span>
                  <Switch checked={!hidden} onCheckedChange={() => prefs.toggleHidden(it.path)} />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-2 pt-2 border-t">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" /> Notificações por módulo
          </h3>
          <ul className="space-y-1">
            {notifiableItems.map(it => {
              const muted = prefs.isMuted(it.path);
              return (
                <li key={it.path} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/40">
                  <span className="text-sm flex items-center gap-2">
                    {muted ? <BellOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Bell className="w-3.5 h-3.5 text-muted-foreground" />}
                    {it.label}
                  </span>
                  <Switch checked={!muted} onCheckedChange={() => prefs.toggleNotif(it.path)} />
                </li>
              );
            })}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
