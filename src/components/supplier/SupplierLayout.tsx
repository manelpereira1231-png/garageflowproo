import { useState, Suspense } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, FolderTree, Warehouse, ShoppingCart, Users,
  CreditCard, Truck, FileText, Star, User, Settings, Menu, X, LogOut, Store,
} from "lucide-react";
import { signOutRealm } from "@/integrations/supabase/realmBridge";

const nav = [
  { to: "/supplier", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/supplier/products", label: "Produtos", icon: Package },
  { to: "/supplier/categories", label: "Categorias", icon: FolderTree },
  { to: "/supplier/stock", label: "Stock", icon: Warehouse },
  { to: "/supplier/orders", label: "Encomendas", icon: ShoppingCart },
  { to: "/supplier/customers", label: "Clientes", icon: Users },
  { to: "/supplier/payments", label: "Pagamentos", icon: CreditCard },
  { to: "/supplier/carriers", label: "Transportadoras", icon: Truck },
  { to: "/supplier/invoices", label: "Faturas", icon: FileText },
  { to: "/supplier/reviews", label: "Avaliações", icon: Star },
  { to: "/supplier/profile", label: "Perfil", icon: User },
  { to: "/supplier/settings", label: "Configurações", icon: Settings },
];

export default function SupplierLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const handleLogout = async () => { await signOutRealm("erp"); };

  return (
    <div className="min-h-screen flex bg-background">
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 gradient-dark border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Store className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">
              Garage<span className="text-sidebar-primary">Flow</span>
              <span className="text-xs ml-1 text-muted-foreground">Supplier</span>
            </span>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active = item.end
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <header className="h-14 lg:h-16 border-b border-border flex items-center px-4 lg:px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-30 gap-3">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-accent min-h-11 min-w-11 flex items-center justify-center">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Rede de Fornecedores</span>
          </div>
        </header>
        <div className="flex-1 p-3 sm:p-4 lg:p-6">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
