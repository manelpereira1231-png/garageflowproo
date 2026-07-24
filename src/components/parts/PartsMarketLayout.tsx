import { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Search, Heart, ShoppingCart, Package, Bell } from "lucide-react";
import { useGsnCart } from "@/hooks/useGsnCart";
import { useGsnNotifications } from "@/hooks/useGsnNotifications";
import { Badge } from "@/components/ui/badge";

function Item({ to, icon: Icon, label, count }: { to: string; icon: any; label: string; count?: number }) {
  return (
    <NavLink to={to} end className={({ isActive }) =>
      `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
      {count && count > 0 ? <Badge variant="secondary" className="ml-auto">{count}</Badge> : null}
    </NavLink>
  );
}

export default function PartsMarketLayout({ children }: { children?: ReactNode }) {
  const { items } = useGsnCart();
  const { unread } = useGsnNotifications();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <NavLink to="/parts" className="font-bold text-lg flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Peças</NavLink>
          <nav className="flex items-center gap-1 flex-1">
            <Item to="/parts" icon={Search} label="Pesquisar" />
            <Item to="/parts/favorites" icon={Heart} label="Favoritos" />
            <Item to="/parts/orders" icon={Package} label="Encomendas" />
          </nav>
          <NavLink to="/parts/notifications" className="relative p-2 rounded-md hover:bg-muted"><Bell className="w-4 h-4" />{unread > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full" />}</NavLink>
          <NavLink to="/parts/cart" className="relative p-2 rounded-md hover:bg-muted flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> {items.length > 0 && <Badge>{items.length}</Badge>}
          </NavLink>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4">{children ?? <Outlet />}</main>
    </div>
  );
}
