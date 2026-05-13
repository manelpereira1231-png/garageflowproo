import { useEffect, useState } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Template {
  id: string;
  template_key: string;
  subject: string;
  html_body: string;
  enabled: boolean;
}

const KEY_LABELS: Record<string, { label: string; help: string; vars: string[] }> = {
  welcome: {
    label: "Boas-vindas (novo cliente)",
    help: "Enviado quando criar um cliente com email.",
    vars: ["{{shop_name}}", "{{client_name}}"],
  },
  first_quote: {
    label: "Primeiro orçamento",
    help: "Enviado quando emitir o primeiro orçamento a um cliente.",
    vars: ["{{shop_name}}", "{{client_name}}", "{{quote_number}}", "{{total}}"],
  },
  first_work_order: {
    label: "Primeiro serviço (Work Order)",
    help: "Enviado quando iniciar o primeiro trabalho num veículo do cliente.",
    vars: ["{{shop_name}}", "{{client_name}}", "{{wo_number}}", "{{vehicle}}"],
  },
  invoice_created: {
    label: "Fatura emitida",
    help: "Enviado a cada fatura emitida.",
    vars: ["{{shop_name}}", "{{client_name}}", "{{invoice_number}}", "{{total}}"],
  },
};

export default function EmailTemplates() {
  const navigate = useNavigate();
  const { activeShopId } = useActiveShopId();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeShopId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, template_key, subject, html_body, enabled")
        .eq("shop_id", activeShopId)
        .order("template_key");
      if (error) toast.error(error.message);
      else setTemplates(data || []);
      setLoading(false);
    })();
  }, [activeShopId]);

  const update = (id: string, patch: Partial<Template>) =>
    setTemplates(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));

  const save = async (t: Template) => {
    setSavingId(t.id);
    const { error } = await supabase
      .from("email_templates")
      .update({ subject: t.subject, html_body: t.html_body, enabled: t.enabled })
      .eq("id", t.id);
    setSavingId(null);
    if (error) toast.error(error.message);
    else toast.success("Template guardado");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary" /> Emails automáticos
          </h1>
          <p className="text-muted-foreground text-sm">
            Personaliza os emails enviados aos clientes em cada momento da jornada.
          </p>
        </div>
      </div>

      {templates.map(tpl => {
        const meta = KEY_LABELS[tpl.template_key] || { label: tpl.template_key, help: "", vars: [] };
        return (
          <Card key={tpl.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">{meta.label}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{meta.help}</p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`en-${tpl.id}`} className="text-xs">
                  {tpl.enabled ? "Ativo" : "Desativado"}
                </Label>
                <Switch
                  id={`en-${tpl.id}`}
                  checked={tpl.enabled}
                  onCheckedChange={v => update(tpl.id, { enabled: v })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Assunto</Label>
                <Input
                  value={tpl.subject}
                  onChange={e => update(tpl.id, { subject: e.target.value })}
                />
              </div>
              <div>
                <Label>Conteúdo HTML</Label>
                <Textarea
                  rows={8}
                  className="font-mono text-xs"
                  value={tpl.html_body}
                  onChange={e => update(tpl.id, { html_body: e.target.value })}
                />
              </div>
              {meta.vars.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Variáveis disponíveis:{" "}
                  {meta.vars.map(v => (
                    <code key={v} className="bg-muted px-1.5 py-0.5 rounded mr-1">{v}</code>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={() => save(tpl)} disabled={savingId === tpl.id}>
                  <Save className="w-4 h-4 mr-2" />
                  {savingId === tpl.id ? "A guardar..." : "Guardar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
