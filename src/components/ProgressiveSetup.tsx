import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Receipt, Wrench, MapPin, Image, X } from "lucide-react";
import { toast } from "sonner";
import { getCountryConfig } from "@/lib/regionConfig";

type PromptType = "nif" | "logo" | "labor_rate" | "address";

interface ProgressiveSetupProps {
  trigger: PromptType;
  onComplete?: () => void;
  children?: React.ReactNode;
}

/**
 * Progressive Setup — mostra prompts contextuais no momento certo:
 * - "nif" → ao criar fatura
 * - "logo" → ao gerar PDF
 * - "labor_rate" → ao criar ordem de serviço
 * - "address" → ao faturar
 */
export default function ProgressiveSetup({ trigger, onComplete, children }: ProgressiveSetupProps) {
  const shopId = useActiveShopId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!shopId || checked) return;
    const check = async () => {
      const { data: shop } = await supabase
        .from("shops")
        .select("nif, logo_url, labor_rate, address")
        .eq("id", shopId)
        .maybeSingle();
      
      if (!shop) { setChecked(true); return; }

      let needsPrompt = false;
      switch (trigger) {
        case "nif": needsPrompt = !shop.nif || shop.nif.trim() === ""; break;
        case "logo": needsPrompt = !shop.logo_url; break;
        case "labor_rate": needsPrompt = !shop.labor_rate || shop.labor_rate === 35; break;
        case "address": needsPrompt = !shop.address || shop.address.trim() === ""; break;
      }

      if (needsPrompt) {
        // Check if user already dismissed this prompt recently
        const dismissKey = `garageflow_dismiss_${trigger}`;
        const dismissed = localStorage.getItem(dismissKey);
        if (dismissed && Date.now() - parseInt(dismissed) < 24 * 60 * 60 * 1000) {
          setChecked(true);
          return;
        }
        setOpen(true);
      }
      setChecked(true);
    };
    check();
  }, [shopId, trigger, checked]);

  const config: Record<PromptType, { icon: any; title: string; desc: string; label: string; placeholder: string; field: string }> = {
    nif: {
      icon: Receipt,
      title: "Adiciona o teu NIF",
      desc: "Para emitir faturas corretamente, adiciona o teu NIF e dados fiscais.",
      label: "NIF / VAT",
      placeholder: "123456789",
      field: "nif",
    },
    logo: {
      icon: Image,
      title: "Adiciona o logo da oficina",
      desc: "Adiciona o logo da tua oficina para documentos mais profissionais.",
      label: "URL do Logo",
      placeholder: "Vai a Definições para carregar o logo",
      field: "logo_url",
    },
    labor_rate: {
      icon: Wrench,
      title: "Define o preço por hora",
      desc: "Define o preço por hora de mão-de-obra para cálculos automáticos.",
      label: `Preço/hora (${getCountryConfig().currencySymbol})`,
      placeholder: "45",
      field: "labor_rate",
    },
    address: {
      icon: MapPin,
      title: "Adiciona a morada da oficina",
      desc: "A morada é necessária para documentos de faturação.",
      label: "Morada",
      placeholder: "Ex: Rua Principal, 123",
      field: "address",
    },
  };

  const c = config[trigger];
  const Icon = c.icon;

  const handleSave = async () => {
    if (!value.trim() || !shopId) return;
    setLoading(true);
    const update: Record<string, any> = {};
    if (trigger === "labor_rate") {
      update[c.field] = parseFloat(value);
    } else {
      update[c.field] = value.trim();
    }
    const { error } = await supabase.from("shops").update(update).eq("id", shopId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Guardado com sucesso!");
      setOpen(false);
      onComplete?.();
    }
    setLoading(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(`garageflow_dismiss_${trigger}`, String(Date.now()));
    setOpen(false);
    onComplete?.();
  };

  const navigate = useNavigate();

  if (trigger === "logo") {
    return (
      <>
        {children}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-primary" />
                {c.title}
              </DialogTitle>
              <DialogDescription>{c.desc}</DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-4">
              <Button onClick={() => { setOpen(false); navigate("/settings"); }} className="flex-1">
                Ir a Definições
              </Button>
              <Button variant="ghost" onClick={handleDismiss}>
                Mais tarde
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-primary" />
              {c.title}
            </DialogTitle>
            <DialogDescription>{c.desc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>{c.label}</Label>
              <Input
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={c.placeholder}
                type={trigger === "labor_rate" ? "number" : "text"}
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={loading || !value.trim()} className="flex-1">
                {loading ? "A guardar..." : "Guardar"}
              </Button>
              <Button variant="ghost" onClick={handleDismiss}>
                Mais tarde
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
