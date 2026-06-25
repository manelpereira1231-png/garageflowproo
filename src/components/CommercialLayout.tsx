import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, KanbanSquare, CalendarClock, HeartHandshake,
  Lightbulb, FileBarChart2, Target, LogOut, Menu, X, ChevronRight, Briefcase,
} from "lucide-react";
import { signOutRealm } from "@/integrations/supabase/realmBridge";
import { useAuthReady } from "@/hooks/useAuthReady";

const nav = [
  { path: "/commercial", label: "Dashboard Executivo", icon: LayoutDashboard, exact: true },
  { path: "/commercial/crm", label: "CRM de Oficinas", icon: Users },
  { path: "/commercial/pipeline", label: "Pipeline de Vendas", icon: KanbanSquare },
  { path: "/commercial/meetings", label: "Centro de Reuniões", icon: CalendarClock },
  { path: "/commercial/retention", label: "Centro de Retenção", icon: HeartHandshake },
  { path: "/commercial/intelligence", label: "Inteligência Comercial", icon: Lightbulb },
  { path: "/commercial/reports", label: "Relatórios", icon: FileBarChart2 },
  { path: "/commercial/objectives", label: "Objetivos", icon: Target },
];

export default function CommercialLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuthReady();

  const handleLogout = async () => {
    await signOutRealm("erp");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 gradient-dark border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">
              Garage<span className="text-sidebar-primary">Flow</span>
              <span className="text-xs ml-1 text-muted-foreground">Comercial</span>
            </span>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-2 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.email || 'Comercial'}</p>
              <p className="text-[10px] text-muted-foreground truncate">Administrador Comercial</p>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-sidebar-border">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="h-14 lg:h-16 border-b border-border flex items-center px-4 lg:px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-30 gap-3">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-accent">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-sm">Painel Comercial</h1>
        </header>
        <div className="flex-1 p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
