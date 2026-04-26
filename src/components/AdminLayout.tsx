import { useState, useEffect, useRef, Suspense } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, LogOut, Menu, X, ChevronRight, Shield, FileText, BarChart3,
  CreditCard, Bell, Settings, Users, Search, Globe, Mail, Activity, Megaphone, ToggleLeft, Tag, TrendingUp,
} from "lucide-react";
import SystemBroadcastBanner from "@/components/SystemBroadcastBanner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";

const navSections = [
  {
    label: "Principal",
    items: [
      { path: "/admin", label: "Painel Geral", icon: LayoutDashboard },
      { path: "/admin/shops", label: "Oficinas", icon: Building2 },
      { path: "/admin/users", label: "Utilizadores", icon: Users },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { path: "/admin/finance", label: "Finanças e Crescimento", icon: TrendingUp },
      { path: "/admin/billing", label: "Planos e Faturação", icon: CreditCard },
      { path: "/admin/coupons", label: "Cupões e Ofertas", icon: Tag },
      { path: "/admin/traffic", label: "Tráfego e Conversões", icon: Globe },
      { path: "/admin/reports", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    label: "Operações",
    items: [
      { path: "/admin/marketing", label: "Marketing", icon: Megaphone },
      { path: "/admin/system", label: "Funcionalidades e Avisos", icon: ToggleLeft },
      { path: "/admin/alerts", label: "Alertas", icon: Bell },
      { path: "/admin/emails", label: "Registo de Emails", icon: Mail },
      { path: "/admin/adoption", label: "Adoção", icon: Activity },
      { path: "/admin/system-health", label: "Saúde do Sistema", icon: Activity },
    ],
  },
  {
    label: "Global",
    items: [
      { path: "/admin/countries", label: "Países e Mercados", icon: Globe },
    ],
  },
  {
    label: "Sistema",
    items: [
      { path: "/admin/partners", label: "Parceiros", icon: Shield },
      { path: "/admin/logs", label: "Auditoria", icon: FileText },
      { path: "/admin/settings", label: "Configurações", icon: Settings },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{id: string; name: string; email: string}[]>([]);
  const [showResults, setShowResults] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // Painel de administração — exclusivamente em PT-PT
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!globalSearch || globalSearch.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const timeout = setTimeout(async () => {
      const q = globalSearch.toLowerCase();
      const { data } = await supabase.from("shops").select("id, name, email").limit(10);
      const filtered = (data || []).filter(s =>
        s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
      );
      setSearchResults(filtered);
      setShowResults(true);
    }, 300);
    return () => clearTimeout(timeout);
  }, [globalSearch]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    sessionStorage.removeItem("garageflow_user_type_cache");
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 gradient-dark border-r border-sidebar-border flex flex-col
        transition-transform duration-300 ease-in-out
        lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">
              Garage<span className="text-sidebar-primary">Flow</span>
              <span className="text-xs ml-1 text-muted-foreground">Admin</span>
            </span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1.5">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item: any) => {
                  const [itemPath, itemQuery] = item.path.split("?");
                  const itemTab = itemQuery ? new URLSearchParams(itemQuery).get("tab") : null;
                  const currentTab = new URLSearchParams(location.search).get("tab");
                  const isActive = location.pathname === itemPath && (itemTab ? itemTab === currentTab : !currentTab || location.pathname !== "/admin/market");
                  return (
                    <Link key={item.path} to={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                        isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      }`}>
                      <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Admin profile */}
        <div className="px-3 py-2 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">Super Admin</p>
              <p className="text-[10px] text-muted-foreground truncate">Controlo total</p>
            </div>
          </div>
        </div>

        <div className="px-3 pb-2">
          <button onClick={async () => {
            const stored = localStorage.getItem("garageflow_active_shop");
            if (!stored) {
              const { data: shops } = await supabase.from("shops").select("id").limit(1);
              if (shops && shops.length > 0) {
                localStorage.setItem("garageflow_active_shop", shops[0].id);
              }
            }
            window.location.href = "/dashboard";
          }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all">
            <Building2 className="w-4.5 h-4.5" />
            Ir para Oficina
          </button>
        </div>

        <div className="p-3 border-t border-sidebar-border">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all">
            <LogOut className="w-4.5 h-4.5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="h-14 lg:h-16 border-b border-border flex items-center px-4 lg:px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-30 gap-3">
          {/* Mobile menu button */}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-accent">
            <Menu className="w-5 h-5" />
          </button>

          {/* Global search */}
          <div className="relative flex-1 max-w-md" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar oficinas..." 
              value={globalSearch} 
              onChange={e => setGlobalSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              className="pl-9 h-9 text-sm"
            />
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                {searchResults.map(s => (
                  <button key={s.id} onClick={() => { navigate(`/admin/shops/${s.id}`); setGlobalSearch(""); setShowResults(false); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-accent text-sm flex flex-col gap-0.5 border-b border-border last:border-0">
                    <span className="font-medium">{s.name || "Sem nome"}</span>
                    <span className="text-xs text-muted-foreground">{s.email}</span>
                  </button>
                ))}
              </div>
            )}
            {showResults && globalSearch.length >= 2 && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 px-4 py-3 text-sm text-muted-foreground">
                Nenhum resultado encontrado
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Painel de Administração</span>
            </div>
          </div>
        </header>

        <SystemBroadcastBanner />
        <div className="flex-1 p-3 sm:p-4 lg:p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
