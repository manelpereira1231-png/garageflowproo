# Plano — Mensagens Sem Código + UI Consistente + Moeda EUR

Três frentes independentes, executadas numa única entrega.

---

## 1. Sistema de Mensagens Automáticas (sem HTML)

### Backend
- Nova tabela `message_templates` (shop_id, slug, channel `email|whatsapp|sms`, name, subject, body_text, variables jsonb, auto_send bool, schedule_minutes int, active bool) + RLS + GRANT.
- Tabela `message_template_events` (slug do evento: quote_created, quote_approved, service_done, invoice_issued, reminder, etc.) — seed inicial.
- Edge function `send-customer-message`:
  - Recebe `{ shop_id, template_slug, channel, recipient, context }`.
  - Renderiza variáveis `{{var}}` no texto puro.
  - Para email: injeta texto num **layout HTML profissional fixo** (header com logo/cor da oficina vinda de `shops`, corpo, CTA opcional, footer) — utilizador nunca vê esse HTML.
  - Para WhatsApp/SMS: envia texto puro.

### Frontend — `/settings/messages`
- Lista de templates por evento.
- Editor visual (sem HTML):
  - Campo **Assunto** (input simples).
  - Campo **Mensagem** (textarea estilo WhatsApp).
  - Barra de **variáveis** clicáveis que inserem `{{cliente_nome}}` etc no cursor.
  - **Pré-visualização ao vivo** com dados fictícios (João Silva / BMW Série 3).
  - Toggle: Envio automático / Aprovação manual.
  - Agendamento (atraso em minutos + janela horária permitida).
- Tabs por canal (Email / WhatsApp / SMS — SMS marcado "em breve").
- Nenhum input de HTML/CSS exposto.

### Variáveis suportadas
`cliente_nome, veiculo, matricula, numero_orcamento, numero_ordem_servico, valor_total, nome_oficina, email, telefone, link_portal`.

---

## 2. Formatação Monetária Global (EUR pt-PT)

- Criar `src/lib/money.ts` com `formatMoney(value, { withSymbol=true })` → usa `Intl.NumberFormat('pt-PT', { style:'currency', currency:'EUR' })` → produz `0,69 €`, `35,00 €/h`.
- Helper `formatHours(h)` → `0,0h`.
- **Refatorar** todas as ocorrências de hardcode `${value}€`, `${value.toFixed(2)}€`, `0.0h × 35€/h` para usar os helpers. Foco prioritário:
  - `WorkOrderTimer` / `LaborTimer` (caso reportado).
  - Quotes, Invoices, Services, Dashboard KPIs, PDFs (jsPDF), Stock, Market listings (EUR onde país=PT).
- Regra: sempre `€` como sufixo com espaço, separador decimal `,`, 2 casas decimais.

### Componente exemplo (timer mão-de-obra)
```
Mão-de-obra: 0,69 €
Tempo: 0,0h × 35,00 €/h
```

---

## 3. Navegação Consistente no Market

Problema: `/market/inspections` (e outras Carity) não usa o layout Market completo, perde menu.

- Auditar `src/App.tsx`: rotas `/market/*` devem **todas** estar dentro de `<MarketLayout>`.
- Garantir que `MarketLayout` mostra a navegação Market (Dashboard, Listings, Inspections, Mensagens, Conta) idêntica em todas as páginas Market — mobile e desktop.
- Páginas alvo a verificar: `MarketInspections`, `CarityShopInspections`, `MarketChat`, `MarketListings`, `MarketAccount`.
- Não cruzar com o ERP (regra de segregação ERP/Market mantida).

---

## Detalhes técnicos
- Migração SQL com GRANTs + RLS multi-tenant via `activeShopId`.
- Realtime na tabela `message_templates` para refletir mudanças sem refresh.
- Email final continua a usar o pipeline `send-transactional-email` existente; novo template **dynamic-customer-message** registado no registry.
- i18n: textos do editor em PT-PT.
- Sem regressões: `PlanGate` mantido onde aplicável (mensagens automáticas podem ser feature gated por plano).

## Ficheiros principais
- `supabase/migrations/<ts>_message_templates.sql`
- `supabase/functions/send-customer-message/index.ts`
- `supabase/functions/_shared/transactional-email-templates/dynamic-customer-message.tsx`
- `src/lib/money.ts`
- `src/pages/settings/MessageTemplates.tsx` + componentes (`TemplateEditor`, `VariablePicker`, `LivePreview`)
- `src/components/workshop/LaborTimer.tsx` (e demais sites monetários)
- `src/App.tsx` (rotas Market)
- `src/components/MarketLayout.tsx` (garantir nav presente em todas as sub-rotas)

## Fora de âmbito
- Integração real com WhatsApp Business API / provedor SMS — apenas estrutura preparada; envio efetivo de WhatsApp/SMS fica para passo seguinte (o pipeline de email entra já funcional).
