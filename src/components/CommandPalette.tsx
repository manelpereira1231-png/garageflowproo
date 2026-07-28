import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useShopContext } from "@/hooks/useShopContext";
import { useShopRole } from "@/hooks/useShopRole";
import { canOpenPath } from "@/lib/rolePaths";
import { formatMoney } from "@/lib/money";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, Car, FileText, Wrench, CalendarDays,
  Package, Receipt, Bell, Settings, Plus, Search, Star, Zap,
  ClipboardCheck, BookOpen, HardHat, UserPlus, CreditCard,
} from "lucide-react";

interface SearchResult {
  id: string;
  type: "client" | "vehicle" | "quote" | "invoice" | "part" | "service" | "catalog" | "appointment";
  title: string;
  subtitle: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { activeShopId } = useShopContext();
  const { role, can, loading: roleLoading } = useShopRole();
  const isPt = language === "pt";
  const permissionsReady = !roleLoading && Boolean(role);
  const canAccess = useCallback(
    (path: string) => permissionsReady && canOpenPath(path, role, can),
    [can, permissionsReady, role],
  );

  // Listen for CMD+K / Ctrl+K and a global "open-command-palette" event
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const openEvt = () => setOpen(true);
    document.addEventListener("keydown", down);
    window.addEventListener("open-command-palette", openEvt);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("open-command-palette", openEvt);
    };
  }, []);

  // Search across tables
  const doSearch = useCallback(
    async (q: string) => {
      if (!q || q.length < 2 || !activeShopId || !permissionsReady) {
        setResults([]);
        return;
      }
      setSearching(true);
      const searchTerm = `%${q}%`;

      const empty = Promise.resolve({ data: [] as any[] });

      const [clientsRes, vehiclesRes, quotesRes, invoicesRes, partsRes, servicesRes, catalogRes, apptsRes] =
        await Promise.all([
          can("clients.view") ? supabase
            .from("clients")
            .select("id, name, phone, email")
            .eq("shop_id", activeShopId)
            .is("deleted_at", null)
            .or(`name.ilike.${searchTerm},phone.ilike.${searchTerm},email.ilike.${searchTerm}`)
            .limit(5) : empty,
          can("vehicles.view") ? supabase
            .from("vehicles")
            .select("id, make, model, plate, clients(name)")
            .eq("shop_id", activeShopId)
            .is("deleted_at", null)
            .or(`plate.ilike.${searchTerm},make.ilike.${searchTerm},model.ilike.${searchTerm}`)
            .limit(5) : empty,
          can("quotes.view") ? supabase
            .from("quotes")
            .select("id, number, total, status, clients(name)")
            .eq("shop_id", activeShopId)
            .or(`number.ilike.${searchTerm}`)
            .limit(5) : empty,
          can("invoices.view") ? supabase
            .from("invoices")
            .select("id, number, total, status, clients(name)")
            .eq("shop_id", activeShopId)
            .or(`number.ilike.${searchTerm}`)
            .limit(5) : empty,
          can("stock.view") ? supabase
            .from("parts")
            .select("id, name, reference, stock_quantity")
            .eq("shop_id", activeShopId)
            .or(`name.ilike.${searchTerm},reference.ilike.${searchTerm}`)
            .limit(5) : empty,
          can("work_orders.view") ? supabase
            .from("work_orders")
            .select("id, number, total, status, technician, clients(name), vehicles(plate,make,model)")
            .eq("shop_id", activeShopId)
            .or(`number.ilike.${searchTerm},technician.ilike.${searchTerm}`)
            .limit(5) : empty,
          can("stock.view") ? supabase
            .from("service_catalog")
            .select("id, name, description, default_price, default_time")
            .eq("shop_id", activeShopId)
            .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
            .limit(5) : empty,
          can("agenda.view") ? supabase
            .from("appointments")
            .select("id, date, time, status, notes, clients(name), vehicles(plate)")
            .eq("shop_id", activeShopId)
            .or(`notes.ilike.${searchTerm}`)
            .limit(5) : empty,
        ]);

      const all: SearchResult[] = [
        ...(clientsRes.data || []).map((c) => ({
          id: c.id,
          type: "client" as const,
          title: c.name,
          subtitle: [c.phone, c.email].filter(Boolean).join(" · "),
        })),
        ...(vehiclesRes.data || []).map((v) => ({
          id: v.id,
          type: "vehicle" as const,
          title: `${v.make} ${v.model} — ${v.plate}`,
          subtitle: (v.clients as any)?.name || "",
        })),
        ...(quotesRes.data || []).map((q) => ({
          id: q.id,
          type: "quote" as const,
          title: q.number,
          subtitle: `${(q.clients as any)?.name || ""} · ${formatMoney(q.total || 0)}`,
        })),
        ...(servicesRes.data || []).map((s: any) => ({
          id: s.id,
          type: "service" as const,
          title: s.number,
          subtitle: `${(s.clients as any)?.name || ""} · ${(s.vehicles as any)?.plate || ""} · ${s.status}`,
        })),
        ...(invoicesRes.data || []).map((i) => ({
          id: i.id,
          type: "invoice" as const,
          title: i.number,
          subtitle: `${(i.clients as any)?.name || ""} · ${formatMoney(i.total || 0)}`,
        })),
        ...(catalogRes.data || []).map((c: any) => ({
          id: c.id,
          type: "catalog" as const,
          title: c.name,
          subtitle: `${c.default_time || 0}min · ${formatMoney(Number(c.default_price || 0))}`,
        })),
        ...(partsRes.data || []).map((p) => ({
          id: p.id,
          type: "part" as const,
          title: p.name,
          subtitle: `${p.reference || ""} · Stock: ${p.stock_quantity}`,
        })),
        ...(apptsRes.data || []).map((a: any) => ({
          id: a.id,
          type: "appointment" as const,
          title: (a.clients as any)?.name || (isPt ? "Marcação" : "Appointment"),
          subtitle: `${a.date || ""} ${a.time ? String(a.time).slice(0, 5) : ""} · ${(a.vehicles as any)?.plate || ""}`,
        })),
      ];

      setResults(all);
      setSearching(false);
    },
    [activeShopId, can, isPt, permissionsReady]
  );

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const handleSelect = (type: string, id: string) => {
    setOpen(false);
    setQuery("");
    switch (type) {
      case "client": if (canAccess("/clients")) navigate("/clients"); break;
      case "vehicle": if (canAccess("/vehicles")) navigate("/vehicles"); break;
      case "quote": if (canAccess(`/quotes/edit/${id}`)) navigate(`/quotes/edit/${id}`); break;
      case "invoice": if (canAccess(`/invoices/${id}`)) navigate(`/invoices/${id}`); break;
      case "part": if (canAccess("/stock")) navigate("/stock"); break;
      case "service": if (canAccess(`/services/edit/${id}`)) navigate(`/services/edit/${id}`); break;
      case "catalog": if (canAccess("/catalog")) navigate("/catalog"); break;
      case "appointment": if (canAccess("/agenda")) navigate("/agenda"); break;
      default: break;
    }
  };

  const handleNav = (path: string) => {
    if (!canAccess(path)) return;
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  const typeIcons: Record<string, any> = {
    client: Users,
    vehicle: Car,
    quote: FileText,
    invoice: Receipt,
    part: Package,
    service: Wrench,
    catalog: BookOpen,
    appointment: CalendarDays,
  };

  const typeLabels: Record<string, string> = {
    client: isPt ? "Cliente" : "Client",
    vehicle: isPt ? "Veículo" : "Vehicle",
    quote: isPt ? "Orçamento" : "Quote",
    invoice: isPt ? "Fatura" : "Invoice",
    part: isPt ? "Peça" : "Part",
    service: isPt ? "Serviço" : "Service",
    catalog: isPt ? "Catálogo" : "Catalog",
    appointment: isPt ? "Marcação" : "Appointment",
  };

  const pages = useMemo(() => [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: isPt ? "Clientes" : "Clients", icon: Users, path: "/clients" },
    { label: isPt ? "Veículos" : "Vehicles", icon: Car, path: "/vehicles" },
    { label: isPt ? "Orçamentos" : "Quotes", icon: FileText, path: "/quotes" },
    { label: isPt ? "Serviços" : "Services", icon: Wrench, path: "/services" },
    { label: isPt ? "Agenda" : "Calendar", icon: CalendarDays, path: "/agenda" },
    { label: isPt ? "Catálogo" : "Catalog", icon: BookOpen, path: "/catalog" },
    { label: "Stock", icon: Package, path: "/stock" },
    { label: isPt ? "Inspeções" : "Inspections", icon: ClipboardCheck, path: "/inspections" },
    { label: isPt ? "Modo Oficina" : language === 'es' ? "Modo Taller" : "Workshop", icon: HardHat, path: "/workshop" },
    { label: isPt ? "Faturas" : "Invoices", icon: Receipt, path: "/invoices" },
    { label: isPt ? "Alertas" : "Alerts", icon: Bell, path: "/alerts" },
    { label: isPt ? "Equipa" : "Team", icon: UserPlus, path: "/team" },
    { label: isPt ? "Definições" : "Settings", icon: Settings, path: "/settings" },
    { label: isPt ? "Faturação" : "Billing", icon: CreditCard, path: "/billing" },
  ].filter((page) => canAccess(page.path)), [canAccess, isPt, language]);

  const quickActions = useMemo(() => [
    { label: isPt ? "Novo Cliente" : "New Client", icon: Plus, path: "/clients", capability: "clients.create" as const },
    { label: isPt ? "Novo Orçamento" : "New Quote", icon: Plus, path: "/quotes/new", capability: "quotes.create" as const },
    { label: isPt ? "Novo Serviço" : "New Service", icon: Plus, path: "/services/new", capability: "work_orders.create" as const },
    { label: isPt ? "Nova Fatura" : "New Invoice", icon: Plus, path: "/invoices/new", capability: "invoices.create" as const },
  ].filter((action) => canAccess(action.path) && can(action.capability)), [can, canAccess, isPt]);

  const searchableEntities = useMemo(() => {
    if (!permissionsReady) return "";
    return [
      can("clients.view") && (isPt ? "clientes" : "clients"),
      can("vehicles.view") && (isPt ? "veículos" : "vehicles"),
      can("quotes.view") && (isPt ? "orçamentos" : "quotes"),
      can("work_orders.view") && (isPt ? "serviços" : "services"),
      can("stock.view") && "stock",
      can("invoices.view") && (isPt ? "faturas" : "invoices"),
      can("agenda.view") && (isPt ? "marcações" : "appointments"),
    ].filter(Boolean).join(", ");
  }, [can, isPt, permissionsReady]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={searchableEntities ? (isPt ? "Pesquisar cliente, matrícula, VIN, orçamento, serviço ou fatura…" : `Search ${searchableEntities}…`) : (isPt ? "Pesquisa indisponível" : "Search unavailable")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching
            ? (isPt ? "A pesquisar..." : "Searching...")
            : (isPt ? "Sem resultados." : "No results found.")}
        </CommandEmpty>

        {/* Search Results */}
        {results.length > 0 && (
          <CommandGroup heading={isPt ? "Resultados" : "Results"}>
            {results.map((r) => {
              const Icon = typeIcons[r.type] || Search;
              return (
                <CommandItem
                  key={`${r.type}-${r.id}`}
                  onSelect={() => handleSelect(r.type, r.id)}
                  className="cursor-pointer"
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{r.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {typeLabels[r.type]} · {r.subtitle}
                    </span>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Quick Actions */}
        {!query && (
          <>
            <CommandGroup heading={isPt ? "Ações Rápidas" : "Quick Actions"}>
              {quickActions.map((a) => (
                <CommandItem key={a.path + a.label} onSelect={() => handleNav(a.path)} className="cursor-pointer">
                  <a.icon className="mr-2 h-4 w-4 text-primary" />
                  <span>{a.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={isPt ? "Navegar" : "Navigate"}>
              {pages.map((p) => (
                <CommandItem key={p.path} onSelect={() => handleNav(p.path)} className="cursor-pointer">
                  <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{p.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
