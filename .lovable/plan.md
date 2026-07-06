## Situação atual verificada
- **Aprovação por link (Orçamentos)**: **JÁ EXISTE** — rota `/quote/:token`, página `QuoteApproval.tsx` com assinatura digital, hash SHA-256, multi-idioma (PT/EN/ES), email de notificação. Falta apenas garantir botões "Copiar link"/"Enviar WhatsApp com link" em todos os cartões/tabelas de Orçamentos.
- **Aprovação de Serviços/Reparações por link**: NÃO existe (só orçamentos têm token).
- **Contabilidade Admin (SAF-T PT)**: NÃO existe página `/admin/accounting`.
- **Tabelas ao estilo Veículos**: várias páginas ainda usam padrão antigo.

## Ordem proposta (uma entrega por iteração, cada uma "totalmente bem feita")

### Iteração 1 — Aprovação por link (fechar a frente)
1. Garantir botão "Copiar link de aprovação" e "Enviar por WhatsApp" nos cards/linhas de `Quotes.tsx` (mobile + desktop).
2. Modelo de email já existe; verificar que o link enviado é o público (`/quote/:token`) e não interno.
3. **Fora do scope inicial**: aprovação de Work Orders/Reparações por link — só faz sentido se o cliente aprovar alterações a meio da reparação; adicionar coluna `public_token`, RPC `get_workorder_by_token`, rota `/workorder/:token` + página. Decidir se queres isto agora ou não.

### Iteração 2 — Contabilidade GarageFlow (Admin)
1. Migração: tabela `platform_company_info` (NIF plataforma, morada, cabeçalho SAF-T) + grants + RLS admin-only.
2. Nova página `/admin/accounting` com filtros de período (mês/trimestre/ano/personalizado) e por oficina.
3. Exportações:
   - CSV: faturação GarageFlow (subscrições Stripe + comissões Market).
   - Relatório contabilista PDF por período.
   - SAF-T PT XML (subset "Faturação") — cabeçalho + MasterFiles (Customer=oficinas) + SourceDocuments (invoices Stripe).
4. Aviso legal "não certificado pela AT" no rodapé de todos os exports.

### Iteração 3 — Uniformização de tabelas
Aplicar o padrão de `Vehicles.tsx` (dual view mobile-cards / desktop-table, sem scroll horizontal na página, badges de estado consistentes, ações sempre visíveis) a: `Services`, `Quotes`, `Workshop` (Reparações), `Invoices`, `Clients`, `Stock`, `Warranties`, `Agenda`. Uma página por vez, com screenshot Playwright de verificação em mobile e desktop.

## Decisão que preciso de ti
1. Confirmas que Iteração 1 pode ficar **só** com botões WhatsApp/copy-link em Quotes (a base já existe), **sem** adicionar aprovação por link para Work Orders? Ou queres também para Work Orders?
2. Confirmas ordem 1 → 2 → 3?
3. Para SAF-T: exportação inclui **apenas** faturas do próprio GarageFlow (subscrições que a plataforma emite) ou também um SAF-T consolidado das faturas de todas as oficinas? (Isto muda muito o esforço.)
