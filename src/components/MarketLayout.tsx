import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, LayoutDashboard, Car, MessageCircle, User, Plus, LogOut, Menu, X, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import MarketPendingPaymentBanner from "@/components/MarketPendingPaymentBanner";
import LegalFooter from "@/components/LegalFooter";

const NAV_ITEMS = [
  { path: "/market/dashboard", label: "Painel", icon: LayoutDashboard },
  { path: "/market/my-listings", label: "Anúncios", icon: Car },
  { path: "/market/purchases", label: "Compras", icon: CreditCard },
  { path: "/market/messages", label: "Mensagens", icon: MessageCircle },
  { path: "/market/profile", label: "Perfil", icon: User },
];

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão terminada");
    navigate("/market");
  };

  return (
    <div className="min-h-screen bg-background">
      <MarketPendingPaymentBanner />
      {/* Top nav — premium glass */}
      <nav className="bg-slate-950/95 backdrop-blur-xl text-white px-4 py-3 sticky top-0 z-50 border-b border-white/[0.06] shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center group-hover:bg-amber-400/25 transition-colors">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
            </div>
            <span className="text-lg font-bold tracking-tight">GarageFlow <span className="text-amber-400">Market</span></span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {NAV_ITEMS.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-9 text-white/65 hover:text-white hover:bg-white/[0.08] transition-all ${active ? "bg-white/10 text-white" : ""}`}
                  >
                    <item.icon className="h-4 w-4 mr-1.5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            <Link to="/market/sell">
              <Button size="sm" className="h-9 bg-amber-500 text-slate-900 hover:bg-amber-400 font-semibold ml-2 shadow-md shadow-amber-500/20 btn-interactive">
                <Plus className="h-4 w-4 mr-1" /> Novo Anúncio
              </Button>
            </Link>
            <Button variant="ghost" size="sm" className="text-white/40 hover:text-white hover:bg-white/[0.08] ml-1" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden mt-3 pb-2 border-t border-white/[0.08] pt-3 space-y-1 animate-fade-in">
            {NAV_ITEMS.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}>
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/[0.05]"}`}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
            <Link to="/market/sell" onClick={() => setMobileOpen(false)}>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-amber-400 font-semibold hover:bg-amber-400/10 transition-colors">
                <Plus className="h-4 w-4" /> Novo Anúncio
              </div>
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.05] w-full text-left transition-colors">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        )}
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6 page-in">
        {children}
      </div>
      <LegalFooter />
    </div>
  );
}
