
# Unificação ERP ↔ Market (oficinas) + isolamento Market público (externos)

## Princípio

- **Oficina autenticada** → vive sempre no ERP. O Market é um *módulo interno* (sub-menu do ERP), partilha sessão, sidebar e dashboard. Nunca é redirecionada para `MarketLayout`.
- **Comprador/Vendedor externo** → vive sempre no `MarketLayout` público. Nunca vê sidebar ERP, dashboard ERP nem rotas `/dashboard`, `/clients`, etc.

A separação já existe parcialmente (realms isolados, `MarketLayout`, `Layout` ERP). Falta:
1. Consolidar o Market dentro do ERP como sub-secção (não como app paralela).
2. Refletir dados do Market no Dashboard ERP.
3. Garantir que oficinas nunca aterram em `MarketLayout`.
4. Garantir que externos nunca aterram em ERP.

## Mudanças

### 1. ERP sidebar — Market como sub-grupo único (`src/components/Layout.tsx`)
Substituir os links soltos atuais ("Marketplace", "Painel Oficina (Market)", "Carteira Market", "Inspeções Market") por **um grupo "Market" colapsável** com sub-itens internos ao ERP:

- Oportunidades  → `/market/opportunities` (nova rota interna, listing de inspeções pendentes para a oficina)
- Inspeções      → `/market/inspections` (já existe — `CarityShopInspections`)
- Propostas      → `/market/offers` (nova rota — lista `carity_inspection_offers` da oficina)
- Carteira       → `/market/wallet` (já existe)
- Histórico      → `/market/history` (nova — escrows concluídos da oficina)
- Estatísticas   → `/market/stats` (nova — KPIs Market da oficina)
- Explorar carros → `/market` (link "discreto", abre Market público em nova aba **se** quiser navegar como comprador)

Tudo dentro do `Layout` ERP — **sem** `MarketLayout`, **sem** navbar Market, **sem** "Voltar ao ERP" (porque nunca saiu).

### 2. Rotas: oficinas nunca renderizam `MarketLayout` operacional (`src/App.tsx`)
Para utilizadores com sessão ERP ativa, as rotas operacionais do Market (`/market/inspections`, `/market/wallet`, `/market/dashboard`, `/market/my-listings`, `/market/purchases`, `/market/payouts`, novas `/market/opportunities|offers|history|stats`) renderizam dentro de `<Layout>` ERP, não `<MarketLayout>`.

`MarketLayout` fica reservado para:
- visitantes não autenticados a navegar no Market público (`/market`, `/market/car/:id`, `/market/stands`, etc.)
- sessões **Market-only** (comprador/vendedor sem oficina associada)

Detecção: `hasErpSession` (já existe via `garageflow_active_shop` no localStorage). Se verdadeiro → wrap em `<Layout>`; senão → wrap em `<MarketLayout>`.

### 3. Dashboard ERP mostra dados do Market (`src/pages/Dashboard.tsx`)
Adicionar bloco "Atividade Market" com:
- Inspeções pendentes (count de `carity_inspections` com `shop_id = activeShop` e `status = 'pending'|'in_progress'`)
- Propostas em aberto (`carity_inspection_offers` da oficina, status `pending`)
- Carteira: saldo (`shop_wallets.balance`)
- Receita Market do mês (soma `shop_wallet_transactions` tipo `inspection_paid`/`sale_commission` no mês)

Mostrar só se `shops.is_carity_partner = true`. Caso contrário, CTA discreto "Ativar Market".

### 4. Fluxo de sincronização (já garantido a nível de DB, validar)
Confirmar que ao completar uma inspeção Market:
- `shop_wallet_transactions` recebe entrada → aparece em "Receita do mês" no Dashboard ERP
- (futuro) criar `work_order` automático a partir de inspeção aceite — fora do scope desta entrega; deixar TODO.

### 5. Isolamento externo (validação)
- `MarketLayout` continua sem nenhum link para `/dashboard`, `/clients`, etc. (já é o caso).
- O botão "Voltar ao ERP" no `MarketLayout` só aparece quando `hasErpSession` é verdadeiro, mas com a mudança #2 oficinas autenticadas raramente caem em `MarketLayout` (só quando exploram o Market público propositadamente).
- Externos (Market-only) nunca veem botão "Voltar ao ERP".

### 6. Novas páginas internas (esqueleto mínimo, dados reais)
- `src/pages/market/MarketOpportunities.tsx` — lista inspeções disponíveis para a oficina aceitar
- `src/pages/market/MarketOffers.tsx` — propostas enviadas pela oficina
- `src/pages/market/MarketHistory.tsx` — histórico de transações Market da oficina
- `src/pages/market/MarketStats.tsx` — KPIs (inspeções/mês, receita/mês, rating)

Todas usam `<Layout>` (header ERP) e o `activeShopId`.

## Detalhes técnicos

```text
Layout ERP (oficinas autenticadas)
├── Operação Diária
├── Faturação
├── Comunicação
├── Crescimento
├── Inventário
├── Administração
└── Market   ← NOVO grupo colapsável
    ├── Oportunidades
    ├── Inspeções
    ├── Propostas
    ├── Carteira
    ├── Histórico
    ├── Estatísticas
    └── Explorar carros (link externo Market público)

MarketLayout (externos / exploração pública)
├── Comprar
├── Vender
├── Stands
├── Favoritos / Mensagens / Conta   (se autenticado Market)
└── (sem nada do ERP)
```

Roteamento (`App.tsx`):
```text
/market, /market/car/:id, /market/stands, /market/sell  → MarketLayout (público)
/market/auth, /market/dashboard, /market/profile etc.    → MarketLayout (Market session)
/market/inspections|wallet|opportunities|offers|history|stats
   if hasErpSession  → Layout ERP
   else              → MarketLayout (Market session)
```

## Ficheiros tocados

- `src/components/Layout.tsx` — reorganizar grupo Market
- `src/App.tsx` — wrap condicional Layout vs MarketLayout para rotas operacionais Market
- `src/pages/Dashboard.tsx` — adicionar bloco "Atividade Market"
- `src/pages/market/MarketOpportunities.tsx` *(novo)*
- `src/pages/market/MarketOffers.tsx` *(novo)*
- `src/pages/market/MarketHistory.tsx` *(novo)*
- `src/pages/market/MarketStats.tsx` *(novo)*

## Fora de scope

- Conversão automática inspeção Market → work_order ERP (deixar TODO documentado).
- Migrações DB: não há schema novo; tudo assenta em tabelas existentes (`carity_inspections`, `carity_inspection_offers`, `market_escrow`, `shop_wallets`, `shop_wallet_transactions`).
