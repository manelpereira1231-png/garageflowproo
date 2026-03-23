import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShopContext } from "@/hooks/useShopContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle, Users, Car, FileText, Receipt, Send, Rocket, X, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface ChecklistItem {
  key: string;
  label: string;
  tooltip: string;
  icon: any;
  link: string;
  done: boolean;
}

export default function OnboardingChecklist() {
  const { activeShopId } = useShopContext();
  const { language } = useLanguage();
  const isPt = language === "pt";
  const isEs = language === "es";
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set());

  const tt = (pt: string, en: string, es: string) => isPt ? pt : isEs ? es : en;

  useEffect(() => {
    if (!activeShopId) return;
    const check = async () => {
      const storageKey = `garageflow_checklist_dismissed_${activeShopId}`;
      if (localStorage.getItem(storageKey) === "true") {
        setDismissed(true);
        setLoading(false);
        return;
      }

      const [clientsRes, vehiclesRes, quotesRes, invoicesRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("shop_id", activeShopId).is("deleted_at", null),
        supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("shop_id", activeShopId).is("deleted_at", null),
        supabase.from("quotes").select("id", { count: "exact", head: true }).eq("shop_id", activeShopId),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("shop_id", activeShopId),
      ]);

      const sentQuotes = await supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", activeShopId)
        .in("status", ["sent", "approved", "rejected"]);

      const newItems: ChecklistItem[] = [
        {
          key: "client",
          label: tt("Criar primeiro cliente", "Create first client", "Crear primer cliente"),
          tooltip: tt("Adicione os dados do seu primeiro cliente", "Add your first client's details", "Añade los datos de tu primer cliente"),
          icon: Users, link: "/clients", done: (clientsRes.count || 0) > 0
        },
        {
          key: "vehicle",
          label: tt("Adicionar primeiro veículo", "Add first vehicle", "Añadir primer vehículo"),
          tooltip: tt("Registe a matrícula e dados do veículo", "Register the vehicle plate and details", "Registra la matrícula y datos del vehículo"),
          icon: Car, link: "/vehicles", done: (vehiclesRes.count || 0) > 0
        },
        {
          key: "quote",
          label: tt("Criar primeiro orçamento", "Create first quote", "Crear primer presupuesto"),
          tooltip: tt("Crie um orçamento profissional em segundos", "Create a professional quote in seconds", "Crea un presupuesto profesional en segundos"),
          icon: FileText, link: "/quotes/new", done: (quotesRes.count || 0) > 0
        },
        {
          key: "send_quote",
          label: tt("Enviar orçamento ao cliente", "Send quote to client", "Enviar presupuesto al cliente"),
          tooltip: tt("Envie por WhatsApp ou email com 1 clique", "Send via WhatsApp or email with 1 click", "Envía por WhatsApp o email con 1 clic"),
          icon: Send, link: "/quotes", done: (sentQuotes.count || 0) > 0
        },
        {
          key: "invoice",
          label: tt("Criar primeira fatura", "Create first invoice", "Crear primera factura"),
          tooltip: tt("Fature o seu trabalho profissionalmente", "Invoice your work professionally", "Factura tu trabajo profesionalmente"),
          icon: Receipt, link: "/invoices/new", done: (invoicesRes.count || 0) > 0
        },
      ];

      setItems(newItems);
      setLoading(false);

      if (newItems.every((i) => i.done)) {
        setTimeout(() => {
          localStorage.setItem(storageKey, "true");
          setDismissed(true);
        }, 5000);
      }
    };
    check();
  }, [activeShopId, isPt, isEs]);

  const seedDemoData = async () => {
    if (!activeShopId || seeding) return;
    setSeeding(true);

    try {
      const clients = [
        { name: "João Silva", phone: "+351 912 345 678", email: "joao.silva@email.pt", shop_id: activeShopId },
        { name: "Maria Santos", phone: "+351 923 456 789", email: "maria.santos@email.pt", shop_id: activeShopId },
        { name: "Carlos Oliveira", phone: "+351 934 567 890", email: "carlos.oliveira@email.pt", shop_id: activeShopId },
      ];

      const { data: insertedClients } = await supabase.from("clients").insert(clients).select("id, name");
      if (!insertedClients || insertedClients.length === 0) throw new Error("Failed to create clients");

      const vehicles = [
        { client_id: insertedClients[0].id, make: "BMW", model: "320d", plate: "AA-00-BB", year: 2020, fuel: "Diesel", mileage: 85000, shop_id: activeShopId },
        { client_id: insertedClients[1].id, make: "Volkswagen", model: "Golf 8", plate: "CC-11-DD", year: 2021, fuel: "Gasolina", mileage: 42000, shop_id: activeShopId },
        { client_id: insertedClients[2].id, make: "Mercedes", model: "Classe A", plate: "EE-22-FF", year: 2019, fuel: "Diesel", mileage: 120000, shop_id: activeShopId },
      ];

      const { data: insertedVehicles } = await supabase.from("vehicles").insert(vehicles).select("id");
      if (!insertedVehicles || insertedVehicles.length === 0) throw new Error("Failed to create vehicles");

      await supabase.from("service_catalog").insert([
        { name: "Revisão Completa", default_price: 149.90, default_time: 120, internal_cost: 45, vat_rate: 23, shop_id: activeShopId },
        { name: "Mudança de Óleo + Filtros", default_price: 79.90, default_time: 45, internal_cost: 25, vat_rate: 23, shop_id: activeShopId },
      ]);

      const { data: numData } = await supabase.rpc("next_number", { _shop_id: activeShopId, _prefix: "ORC" });
      const quoteLines = [
        { description: "Revisão completa", quantity: 1, unitPrice: 149.90, vatRate: 23, cost: 45, type: "service" },
        { description: "Filtro de óleo", quantity: 1, unitPrice: 12.50, vatRate: 23, cost: 6, type: "part" },
      ];
      const subtotal = 162.40;
      const vatTotal = subtotal * 0.23;
      const total = subtotal + vatTotal;

      await supabase.from("quotes").insert({
        shop_id: activeShopId,
        client_id: insertedClients[0].id,
        vehicle_id: insertedVehicles[0].id,
        number: numData || "ORC-0001",
        lines: quoteLines as any,
        subtotal,
        vat_total: vatTotal,
        total,
        cost_total: 51,
        profit: subtotal - 51,
        status: "draft",
      });

      const { data: invNum } = await supabase.rpc("next_invoice_number", { _shop_id: activeShopId });
      const { data: insertedInvoice } = await supabase.from("invoices").insert({
        shop_id: activeShopId,
        client_id: insertedClients[1].id,
        vehicle_id: insertedVehicles[1].id,
        number: invNum || "FAT-2026-0001",
        subtotal: 79.90,
        vat_total: 18.38,
        total: 98.28,
        status: "issued",
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      }).select("id").maybeSingle();

      if (insertedInvoice) {
        await supabase.from("invoice_items").insert({
          invoice_id: insertedInvoice.id,
          description: "Mudança de óleo + filtros",
          quantity: 1,
          unit_price: 79.90,
          vat_rate: 23,
          total: 98.28,
        });
      }

      // Animate all items as completed
      setJustCompleted(new Set(["client", "vehicle", "quote", "invoice"]));
      toast.success(tt("Dados de demonstração criados! 🚀", "Demo data created! 🚀", "¡Datos demo creados! 🚀"));
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast.error(tt("Erro ao criar dados demo", "Error creating demo data", "Error al crear datos demo"));
    }
    setSeeding(false);
  };

  if (loading || dismissed) return null;

  const doneCount = items.filter((i) => i.done).length;
  const progress = Math.round((doneCount / items.length) * 100);
  const nextItem = items.find(i => !i.done);

  if (doneCount === items.length) {
    return (
      <div className="bg-success/10 border border-success/30 rounded-xl p-5 mb-6 flex items-center gap-3 animate-fade-in">
        <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center shrink-0 check-animated">
          <Rocket className="w-5 h-5 text-success" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-success">
            {tt("Configuração completa! 🎉", "Setup complete! 🎉", "¡Configuración completa! 🎉")}
          </p>
          <p className="text-xs text-muted-foreground">
            {tt("A sua oficina está pronta para faturar.", "Your workshop is ready to go.", "Tu taller está listo para facturar.")}
          </p>
        </div>
        <button onClick={() => { localStorage.setItem(`garageflow_checklist_dismissed_${activeShopId}`, "true"); setDismissed(true); }}>
          <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card border-2 border-primary/20 rounded-xl p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">
              {tt("Configure a sua oficina", "Set up your workshop", "Configure su taller")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {doneCount}/{items.length} {tt("passos concluídos", "steps completed", "pasos completados")}
              {nextItem && (
                <span className="ml-1 text-primary font-medium">
                  — {tt("Próximo", "Next", "Siguiente")}: {nextItem.label}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {doneCount === 0 && (
            <Button size="sm" variant="outline" onClick={seedDemoData} disabled={seeding}
              className="text-xs btn-interactive">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              {seeding
                ? tt("A criar...", "Creating...", "Creando...")
                : tt("Dados Demo", "Demo Data", "Datos Demo")}
            </Button>
          )}
          <button onClick={() => { localStorage.setItem(`garageflow_checklist_dismissed_${activeShopId}`, "true"); setDismissed(true); }}>
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </div>
      </div>

      <Progress value={progress} className="h-2.5 mb-4" />

      <div className="space-y-2">
        {items.map((item, idx) => {
          const isNext = !item.done && idx === items.findIndex(i => !i.done);
          const wasJustCompleted = justCompleted.has(item.key);

          return (
            <Link
              key={item.key}
              to={item.link}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group relative ${
                item.done
                  ? "bg-success/5 text-muted-foreground"
                  : isNext
                    ? "bg-primary/5 border-2 border-primary/30 onboarding-highlight hover:bg-primary/10"
                    : "bg-muted/50 hover:bg-muted border border-transparent"
              }`}
            >
              {item.done || wasJustCompleted ? (
                <CheckCircle className={`w-5 h-5 text-success shrink-0 ${wasJustCompleted ? 'check-animated' : ''}`} />
              ) : (
                <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center
                  ${isNext ? 'border-primary bg-primary/10' : 'border-muted-foreground/30'}`}>
                  {isNext && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
              )}
              <item.icon className={`w-4 h-4 shrink-0 ${isNext ? 'text-primary' : ''}`} />
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium block ${item.done ? "line-through" : isNext ? "text-foreground" : ""}`}>
                  {item.label}
                </span>
                {isNext && (
                  <span className="text-xs text-muted-foreground">{item.tooltip}</span>
                )}
              </div>
              {isNext && (
                <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
