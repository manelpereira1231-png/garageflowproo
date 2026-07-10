
# Correção Global do GarageFlow Market

Vou dividir o trabalho em 5 lotes independentes. Todos são **frontend/UI apenas** — não alteram ERP, autenticação, RLS, arquitetura da BD ou integrações existentes. A única alteração de schema é **adicional e opcional**: coluna `country` em `market_listings` (Lote 3).

---

## Lote 1 — Responsividade (Desktop + Mobile)

**Problema:** utilizador tem de fazer zoom 75% no desktop; mobile corta conteúdos; painel da Oficina (`/market/inspections`) fica em loading eterno.

**Ações:**
- `src/components/MarketLayout.tsx`: remover larguras fixas / `max-w-*` restritivos no container principal; usar `w-full` + `px-3 sm:px-4 lg:px-6` + `max-w-[1600px] mx-auto` no wrapper de conteúdo (não em cada card).
- Garantir `overflow-x-hidden` no `<body>` do market e substituir tabelas por padrão `hidden sm:block / sm:hidden` dual-view onde faltar (Listings, Compras, Mensagens, Carteira, Pagamentos).
- Corrigir a rota **"Painel Oficina"** (imagem 3, ecrã em loading infinito):
  - Investigar `/market/inspections` (CarityShopInspections) — o botão do topbar leva para lá mas fica preso no spinner.
  - Aplicar timeout ao carregamento + fallback de erro, e certificar que o guard não redireciona para `/market/auth` quando já existe sessão ERP (respeitar `authRealm`).
- Meta viewport confirmado em `index.html` (sem `user-scalable=no`).

## Lote 2 — Internacionalização (chaves cruas visíveis)

**Problema:** aparece `dash.empty.title` / `dash.empty.desc` no dashboard.

**Ações:**
- `src/i18n/marketTranslations.ts`: adicionar as chaves em falta (`dash.empty.title`, `dash.empty.desc`, e outras detectadas com `rg "dash\."` no market) em **todas as línguas** já suportadas pelo ERP (pt, pt-BR, en, es, hi).
- Unificar Market com o sistema do ERP: em vez de manter `marketTranslations.ts` separado, fazer merge para o `LanguageContext` do ERP — o hook `useLanguage()` já cobre ambos e cai automaticamente para EN quando falta chave.
- Fallback duplo: chave → EN → chave literal apenas em dev (em produção nunca mostrar a chave; mostrar string vazia ou o rótulo em EN).

## Lote 3 — Multi-moeda + País do Veículo

**Moeda (frontend-only):**
- Novo helper `src/lib/marketCurrency.ts` que usa `Intl.NumberFormat` com moeda por país (EUR, USD, GBP, CHF, BRL, CAD, AUD, JPY, AED, NOK, SEK, DKK, PLN, CZK, HUF, INR…).
- Todas as listagens do Market passam a formatar preço via este helper com base em `listing.country` (fallback: país do utilizador do `regionConfig`).
- **Valor guardado em BD não muda** — só a apresentação.

**País do veículo (mínima alteração de schema):**
- Migration: `ALTER TABLE market_listings ADD COLUMN country text;` + backfill = país do vendedor. Sem alterar RLS.
- Formulário de criação/edição de anúncio: selector obrigatório de país (lista dos países já ativos em `country_settings`).
- Filtros na directory (`MarketStandsDirectory`, `CarityMarketplace`): filtro por país.
- Página de detalhe: badge "Veículo em 🇵🇹 Portugal".

## Lote 4 — Perfil da Oficina + Distinção de Papéis

**Problema:** No `/market/profile`, quando o utilizador é oficina, faltam NIF e Nome da oficina. E o marketplace confunde "oficina-compradora" (particular que também tem ERP) com "oficina-parceira" (que faz inspeções).

**Ações:**
- `src/pages/MarketProfile.tsx`: se o utilizador tem `shop` associada, mostrar bloco extra **"Dados da Oficina"** (Nome da Oficina, NIF/VAT, Morada) em modo leitura + botão "Editar no ERP".
- `useShopMarketStatus` já indica se é oficina; adicionar flag `isInspectionPartner` (oficina com `marketplace_status='approved'` E `inspection_partner=true`) vs `isBuyerOnly`.
- UI diferencia:
  - **Oficina Parceira (inspeções):** vê "Painel Oficina" no topbar + rota `/market/inspections`.
  - **Oficina como comprador/vendedor normal:** NÃO vê "Painel Oficina".
  - **Particular:** só vê Painel/Anúncios/Compras/Favoritos.

## Lote 5 — Comissões na Landing do Market

- `src/pages/CarityMarketplace.tsx` (landing/hero): secção "Como funciona" com as percentagens exatas que a plataforma retém:
  - **Vendedor Particular:** X% (ler de `platform_settings` / `country_settings`).
  - **Stand / Profissional:** Y%.
  - **Oficina Parceira (inspeção):** valor fixo por inspeção.
- Valores lidos dinamicamente (nunca hard-coded).

---

## Ficheiros que vão ser tocados (estimativa)

```
src/components/MarketLayout.tsx
src/pages/MarketDashboard.tsx
src/pages/MarketProfile.tsx
src/pages/MarketStandsDirectory.tsx
src/pages/CarityMarketplace.tsx
src/pages/CarityShopInspections.tsx          (fix loading)
src/pages/market/*                            (dual-view responsivo)
src/i18n/marketTranslations.ts                (chaves em falta)
src/lib/marketCurrency.ts                     (NOVO)
src/hooks/useShopMarketStatus.ts              (flag inspection_partner)
supabase/migrations/*                         (ADD COLUMN country)
```

## Fora de âmbito (não vou tocar)
- ERP, dashboard, RLS, auth, edge functions existentes.
- Estrutura de user_roles, shops, subscribers.
- Fluxos de escrow / Stripe Connect.

---

## Ordem de execução proposta

1. **Lote 1 (responsividade + fix Painel Oficina em loading)** — bloqueia UX agora.
2. **Lote 2 (chaves i18n cruas)** — visualmente crítico.
3. **Lote 4 (perfil oficina + distinção de papéis)** — pedido explícito.
4. **Lote 5 (percentagens na landing)** — rápido.
5. **Lote 3 (multi-moeda + país do veículo)** — maior, requer migration.

**Pergunta antes de avançar:** confirmas que posso adicionar a coluna `country` em `market_listings` (Lote 3)? Se preferires, faço os Lotes 1, 2, 4 e 5 primeiro sem tocar em BD, e o Lote 3 fica para depois da validação.
