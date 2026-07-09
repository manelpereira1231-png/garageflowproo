import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageCircle, Smartphone, Sparkles, Eye, Save } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";

type Channel = "email" | "whatsapp" | "sms";

const EVENTS: { slug: string; title: string; description: string }[] = [
  { slug: "quote_created", title: "Orçamento Criado", description: "Quando um novo orçamento é gerado para o cliente." },
  { slug: "quote_approved", title: "Orçamento Aprovado", description: "Quando o cliente aprova o orçamento." },
  { slug: "service_started", title: "Serviço Iniciado", description: "Quando a oficina começa o trabalho." },
  { slug: "service_done", title: "Serviço Concluído", description: "Viatura pronta para entrega." },
  { slug: "invoice_issued", title: "Fatura Emitida", description: "Quando a fatura é emitida." },
  { slug: "appointment_reminder", title: "Lembrete de Marcação", description: "Lembrete da marcação para o cliente." },
];

const VARIABLES = [
  { key: "cliente_nome", label: "Nome do Cliente", sample: "João Silva" },
  { key: "veiculo", label: "Veículo", sample: "BMW Série 3" },
  { key: "matricula", label: "Matrícula", sample: "12-AB-34" },
  { key: "numero_orcamento", label: "Nº Orçamento", sample: "ORC-2026-0042" },
  { key: "numero_ordem_servico", label: "Nº Ordem Serviço", sample: "OS-2026-0017" },
  { key: "valor_total", label: "Valor Total", sample: formatMoney(289.5) },
  { key: "valor_mao_obra", label: "Mão-de-obra (discriminada)", sample: `${formatMoney(70)} (2,0h × ${formatMoney(35)}/h)` },
  { key: "horas_mao_obra", label: "Horas de mão-de-obra", sample: "2,0h" },
  { key: "tarifa_mao_obra", label: "Tarifa horária", sample: `${formatMoney(35)}/h` },
  { key: "nome_oficina", label: "Nome Oficina", sample: "Auto Center Lisboa" },
  { key: "email", label: "Email Oficina", sample: "geral@oficina.pt" },
  { key: "telefone", label: "Telefone Oficina", sample: "+351 21 000 0000" },
  { key: "link_portal", label: "Link Portal Cliente", sample: "https://garageflow.pt/portal/xyz" },
];

const SAMPLE: Record<string, string> = VARIABLES.reduce((acc, v) => ({ ...acc, [v.key]: v.sample }), {});

function renderPreview(text: string): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => SAMPLE[k] ?? `{{${k}}}`);
}

const DEFAULTS: Record<string, { subject: string; body: string }> = {
  quote_created: {
    subject: "O seu orçamento {{numero_orcamento}} está pronto",
    body:
      "Olá {{cliente_nome}},\n\nO orçamento para o seu {{veiculo}} ({{matricula}}) está pronto.\n\nNº: {{numero_orcamento}}\nMão-de-obra: {{valor_mao_obra}}\nValor total: {{valor_total}}\n\nPode consultá-lo aqui: {{link_portal}}\n\nObrigado,\n{{nome_oficina}}",
  },
  quote_approved: {
    subject: "Recebemos a aprovação do orçamento {{numero_orcamento}}",
    body: "Olá {{cliente_nome}},\n\nRecebemos a sua aprovação. Vamos avançar com o trabalho no {{veiculo}}.\n\nResumo:\n• Mão-de-obra: {{valor_mao_obra}}\n• Total aprovado: {{valor_total}}\n\nObrigado,\n{{nome_oficina}}",
  },
  service_started: {
    subject: "Começámos o serviço no seu {{veiculo}}",
    body: "Olá {{cliente_nome}},\n\nIniciámos o trabalho no seu {{veiculo}} ({{matricula}}). Avisamos quando estiver pronto.\n\n{{nome_oficina}}",
  },
  service_done: {
    subject: "O seu {{veiculo}} está pronto para entrega",
    body: "Olá {{cliente_nome}},\n\nO trabalho no {{veiculo}} ({{matricula}}) terminou e está pronto para levantamento.\n\nMão-de-obra: {{valor_mao_obra}}\nValor total: {{valor_total}}\n\nObrigado,\n{{nome_oficina}}\n{{telefone}}",
  },
  invoice_issued: {
    subject: "Fatura emitida — {{numero_ordem_servico}}",
    body: "Olá {{cliente_nome}},\n\nEmitimos a fatura referente ao serviço {{numero_ordem_servico}}.\n\nMão-de-obra: {{valor_mao_obra}}\nValor total: {{valor_total}}\n\n{{nome_oficina}}",
  },
  appointment_reminder: {
    subject: "Lembrete: marcação na {{nome_oficina}}",
    body: "Olá {{cliente_nome}},\n\nLembramos a marcação do seu {{veiculo}}. Até breve!\n\n{{nome_oficina}}",
  },
};

interface TemplateRow {
  id?: string;
  event_slug: string;
  channel: Channel;
  name: string;
  subject: string;
  body_text: string;
  auto_send: boolean;
  schedule_minutes: number;
  allowed_hours_start: number;
  allowed_hours_end: number;
  active: boolean;
}

function emptyTemplate(event_slug: string, channel: Channel): TemplateRow {
  const def = DEFAULTS[event_slug] ?? { subject: "", body: "" };
  return {
    event_slug,
    channel,
    name: EVENTS.find((e) => e.slug === event_slug)?.title ?? event_slug,
    subject: channel === "email" ? def.subject : "",
    body_text: def.body,
    auto_send: false,
    schedule_minutes: 0,
    allowed_hours_start: 8,
    allowed_hours_end: 20,
    active: true,
  };
}

const CHANNEL_META: Record<Channel, { label: string; icon: any; disabled?: boolean }> = {
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  sms: { label: "SMS (em breve)", icon: Smartphone, disabled: true },
};

export default function MessageTemplates() {
  const shopId = useActiveShopId();
  const [activeEvent, setActiveEvent] = useState(EVENTS[0].slug);
  const [activeChannel, setActiveChannel] = useState<Channel>("email");
  const [rows, setRows] = useState<Record<string, TemplateRow>>({});
  const [loading, setLoading] = useState(true);

  const key = `${activeEvent}:${activeChannel}`;
  const tpl = rows[key] ?? emptyTemplate(activeEvent, activeChannel);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("message_templates")
        .select("*")
        .eq("shop_id", shopId);
      if (cancelled) return;
      const map: Record<string, TemplateRow> = {};
      (data ?? []).forEach((r: TemplateRow) => {
        map[`${r.event_slug}:${r.channel}`] = r;
      });
      setRows(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [shopId]);

  const update = (patch: Partial<TemplateRow>) => {
    setRows((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyTemplate(activeEvent, activeChannel)), ...patch } }));
  };

  const insertVariable = (k: string) => {
    update({ body_text: (tpl.body_text || "") + ` {{${k}}}` });
  };

  const save = async () => {
    if (!shopId) return toast.error("Selecione uma oficina");
    const payload = { ...tpl, shop_id: shopId };
    const { error, data } = await (supabase as any)
      .from("message_templates")
      .upsert(payload, { onConflict: "shop_id,event_slug,channel" })
      .select()
      .single();
    if (error) return toast.error("Erro a guardar: " + error.message);
    setRows((prev) => ({ ...prev, [key]: data }));
    toast.success("Template guardado");
  };

  const previewSubject = useMemo(() => renderPreview(tpl.subject || ""), [tpl.subject]);
  const previewBody = useMemo(() => renderPreview(tpl.body_text || ""), [tpl.body_text]);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Mensagens Automáticas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escreva como se fosse uma mensagem normal. Sem HTML, sem código. Use as variáveis clicando no botão.
        </p>
      </div>

      <div className="grid lg:grid-cols-[260px,1fr] gap-6">
        {/* Lista de eventos */}
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">Eventos</CardTitle></CardHeader>
          <CardContent className="space-y-1 p-2">
            {EVENTS.map((ev) => {
              const active = ev.slug === activeEvent;
              const configured = !!rows[`${ev.slug}:${activeChannel}`];
              return (
                <button
                  key={ev.slug}
                  onClick={() => setActiveEvent(ev.slug)}
                  className={`w-full text-left px-3 py-2 rounded-md transition ${active ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                >
                  <div className="font-medium text-sm flex items-center gap-2">
                    {ev.title}
                    {configured && <Badge variant="secondary" className="text-[10px]">configurado</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{ev.description}</div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Editor */}
        <div className="space-y-4">
          <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as Channel)}>
            <TabsList>
              {(Object.keys(CHANNEL_META) as Channel[]).map((c) => {
                const Icon = CHANNEL_META[c].icon;
                return (
                  <TabsTrigger key={c} value={c} disabled={CHANNEL_META[c].disabled}>
                    <Icon className="h-4 w-4 mr-1.5" /> {CHANNEL_META[c].label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={activeChannel} className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Conteúdo</CardTitle>
                  <CardDescription>O design profissional do email é gerado automaticamente. Você só escreve o texto.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeChannel === "email" && (
                    <div className="space-y-1.5">
                      <Label>Assunto</Label>
                      <Input value={tpl.subject} onChange={(e) => update({ subject: e.target.value })} placeholder="Ex: O seu orçamento está pronto" />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Mensagem</Label>
                    <Textarea
                      rows={10}
                      value={tpl.body_text}
                      onChange={(e) => update({ body_text: e.target.value })}
                      placeholder="Olá {{cliente_nome}},..."
                      className="font-mono text-sm"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {VARIABLES.map((v) => (
                        <button
                          key={v.key}
                          onClick={() => insertVariable(v.key)}
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-primary hover:text-primary-foreground transition"
                          title={`Inserir {{${v.key}}}`}
                        >
                          + {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Pré-visualização</CardTitle>
                  <CardDescription>Como o cliente {SAMPLE.cliente_nome} ({SAMPLE.veiculo}) vai receber.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-card overflow-hidden">
                    {activeChannel === "email" && (
                      <div className="px-4 py-3 border-b bg-muted/30 text-sm">
                        <div><span className="text-muted-foreground">De: </span>{SAMPLE.nome_oficina}</div>
                        <div><span className="text-muted-foreground">Assunto: </span><strong>{previewSubject || <em className="text-muted-foreground">(sem assunto)</em>}</strong></div>
                      </div>
                    )}
                    <div className="p-4 whitespace-pre-wrap text-sm leading-relaxed">
                      {previewBody || <em className="text-muted-foreground">(escreva a mensagem para ver a pré-visualização)</em>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Automação</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Envio automático</Label>
                      <p className="text-xs text-muted-foreground">Se desligado, fica para aprovação manual antes de enviar.</p>
                    </div>
                    <Switch checked={tpl.auto_send} onCheckedChange={(v) => update({ auto_send: v })} />
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Atraso (minutos)</Label>
                      <Input type="number" min={0} value={tpl.schedule_minutes} onChange={(e) => update({ schedule_minutes: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Janela início (h)</Label>
                      <Input type="number" min={0} max={23} value={tpl.allowed_hours_start} onChange={(e) => update({ allowed_hours_start: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Janela fim (h)</Label>
                      <Input type="number" min={0} max={23} value={tpl.allowed_hours_end} onChange={(e) => update({ allowed_hours_end: Number(e.target.value) || 23 })} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Switch checked={tpl.active} onCheckedChange={(v) => update({ active: v })} />
                      <Label>Ativo</Label>
                    </div>
                    <Button onClick={save} disabled={loading}>
                      <Save className="h-4 w-4 mr-1.5" /> Guardar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
