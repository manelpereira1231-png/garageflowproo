import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, Users, Car, FileText, Wrench, Settings, 
  Menu, X, LogOut, ChevronRight, Globe, CreditCard, Bell
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Language } from "@/i18n/translations";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();

  const navItems = [
    { path: "/dashboard", label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: "/clients", label: t('nav.clients'), icon: Users },
    { path: "/vehicles", label: t('nav.vehicles'), icon: Car },
    { path: "/quotes", label: t('nav.quotes'), icon: FileText },
    { path: "/services", label: t('nav.services'), icon: Wrench },
    { path: "/alerts", label: t('nav.alerts'), icon: Bell },
    { path: "/billing", label: t('nav.billing'), icon: CreditCard },
    { path: "/settings", label: t('nav.settings'), icon: Settings },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Wrench className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">
              Garage<span className="text-sidebar-primary">Flow</span>
            </span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}>
                <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
                {item.label}
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Language Selector */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 px-3 py-2">
            <Globe className="w-4 h-4 text-sidebar-foreground" />
            <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
              <SelectTrigger className="h-8 bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-3 border-t border-sidebar-border">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all">
            <LogOut className="w-4.5 h-4.5" />
            {t('auth.logout')}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-border flex items-center px-4 lg:px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <Button variant="ghost" size="icon" className="lg:hidden mr-2" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
        </header>
        <div className="flex-1 p-4 lg:p-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
