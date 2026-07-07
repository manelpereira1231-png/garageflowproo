
# Auditoria completa de UI/UX e responsividade — GarageFlow

Esta auditoria toca ~120 páginas e dezenas de componentes. Para garantir qualidade real (não cosmética) e não gastar créditos em fixes ao lado, proponho um plano em **4 fases sequenciais**, cada fase entregável e verificável antes de avançar.

## Regras globais que vou aplicar em todas as fases

1. **Nunca só ícones**: cada botão de ação ganha texto (ou `aria-label` quando o ícone é secundário como fechar/menu). Regra confirmada.
2. **Zero scroll horizontal em desktop**: `overflow-x-hidden` no `<main>` + tabelas grandes com wrapper `overflow-x-auto` (só em mobile).
3. **Tokens semânticos apenas**: sem `text-white`, `bg-black`, `#hex` — tudo via `hsl(var(--...))`.
4. **Tap targets ≥ 44px** em mobile; ícones-only ≥ 40×40.
5. **Um `<main>` por rota** no Layout, não nas páginas.
6. **Container padrão**: `max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8` — largura total inteligente sem "esticar" texto.
7. **Tabelas responsivas**: padrão dual view `hidden sm:block` (tabela) + `sm:hidden` (cards) já existente, aplicado onde falta.
8. **Modais**: `max-h-[90vh] overflow-y-auto`, `w-[95vw]` em mobile, botões sempre visíveis (footer sticky).
9. **Tipografia consistente**: `text-xl lg:text-2xl` para h1 de página, `text-sm` corpo, `text-xs` metadados.

## Fase 1 — Auditoria automática (1 turno)

Executo Playwright em 3 viewports (375, 768, 1440) sobre ~25 páginas críticas:
Landing, Auth, Dashboard, Clients, Vehicles, Services, Quotes, QuoteForm, Workshop, Invoices, InvoiceForm, Stock, ServiceCatalog, Agenda, Team, Reports, Settings, BillingIntegration, Market landing, MarketDashboard, MarketListingDetail, Admin Dashboard, Admin Shops, Admin Users, Admin Support.

Por cada página: screenshot + deteção de `document.documentElement.scrollWidth > clientWidth` (overflow horizontal) + inventário de botões só-ícone sem label. Resultado consolidado num relatório `docs/UI_AUDIT.md`.

## Fase 2 — Fundações globais (1 turno)

Ficheiros afetados: `src/components/Layout.tsx`, `src/components/MarketLayout.tsx`, `src/components/AdminLayout.tsx`, `src/components/CommercialLayout.tsx`, `src/index.css`.

- Wrapper principal com container padrão + `overflow-x-hidden`.
- `<main>` único por layout.
- Ajuste do sidebar/topbar em breakpoints (drawer em mobile, colapsável em tablet, fixo em desktop).
- Classe utilitária `.page-shell` e `.page-header` em `index.css` para uniformizar.

## Fase 3 — Correções página a página (2–3 turnos)

Em cada página do checklist do utilizador aplico:
- Substituição de botões só-ícone por versões com texto (mantendo `size="icon"` só onde é universalmente reconhecido: menu ☰, fechar ✕, arrastar).
- Tabelas → dual view mobile/desktop consistente.
- Formulários → `grid grid-cols-1 sm:grid-cols-2` com labels sempre acima do input.
- Cards KPI → `grid grid-cols-2 sm:grid-cols-4`.
- Modais → tamanhos e scroll internos.
- Remoção de duplicados de headers e ações.

Ordem de execução (prioridade por uso real):
1. Dashboard, Clients, Vehicles, Quotes/QuoteForm, Services/ServiceForm, Workshop, Invoices/InvoiceForm
2. Stock, ServiceCatalog, Agenda, Team, Reports, Settings, BillingIntegration
3. Admin (Dashboard, Shops, Users, Support, restantes)
4. Market (Dashboard, ListingDetail, Chat, Wallet)
5. Landing pages (LandingPage, GratisLanding, Auth)

## Fase 4 — Verificação final (1 turno)

Nova varredura Playwright nos mesmos 25 endpoints × 3 viewports. Confirmo:
- Zero overflow horizontal em desktop.
- Todos os botões críticos com texto visível.
- Zero elementos cortados/sobrepostos nas screenshots.

Atualizo `docs/UI_AUDIT.md` com o "antes/depois".

## Detalhes técnicos

```text
Container padrão:
  <div class="max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8">

Botão com texto (padrão):
  <Button><Icon class="w-4 h-4" /><span>Ação</span></Button>

Ícone-only (raro, só menu/fechar):
  <Button size="icon" aria-label="Fechar"><X /></Button>

Tabela responsiva:
  <div class="hidden sm:block"><Table>...</Table></div>
  <div class="sm:hidden space-y-2">{items.map(Card)}</div>

Modal responsivo:
  <DialogContent class="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
```

## O que **não** faz parte deste plano

- Redesign visual (mudança de paleta, fontes, ilustrações) — mantém-se a identidade dark industrial + amber já definida em memória.
- Novas features ou lógica de negócio.
- Traduções (i18n) — só copy que já existe.

## Confirmação

Confirmas que avanço pela Fase 1 (auditoria automática + relatório) já a seguir? Se quiseres priorizar diferente (ex.: saltar Landing/Market e focar só no ERP), diz agora.
