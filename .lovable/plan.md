# Plano — Stands (Dealers) no GarageFlow Market

Objectivo: permitir que stands publiquem muitos carros com pacote de preço reduzido, garantindo que **as inspeções são SEMPRE feitas por oficinas parceiras nossas** (nunca pelo próprio stand), e promovendo os stands no SEO.

---

## 1. Conta "Stand" (novo tipo de vendedor)

Hoje o Market só tem `particular`. Vamos adicionar `dealer` (stand).

**BD — `carity_seller_profiles`:**
- `account_type` ∈ `particular | dealer` (default `particular`)
- `dealer_company_name`, `dealer_nif`, `dealer_license` (alvará INCM/IMT)
- `dealer_logo_url`, `dealer_slug` (para `/market/stand/:slug`)
- `dealer_plan` ∈ `free | starter | pro | unlimited`
- `dealer_active_until` (validade da subscrição)

**Onboarding stand:** novo fluxo `/market/auth?mode=signup&account=dealer` que recolhe NIF, alvará, logo. KYC obrigatório antes de publicar.

---

## 2. Pacotes de volume (preço em conta para stand)

Tabela nova `dealer_plans` lida do `country_settings` (multi-país):

| Plano | Anúncios activos | Inspeções incluídas/mês | Preço/mês PT |
|---|---|---|---|
| Starter | até 10 | 5 | 39 € |
| Pro | até 30 | 20 | 99 € |
| Unlimited | ilimitado | ilimitado* | 249 € |

*Inspeções acima da quota: 19,90 € cada (vs 29,90 € particular).
Comissão de venda: 1% (vs 3% particular).

Pagamento via Stripe subscription. Quota verificada server-side por RPC `dealer_can_publish(user_id)`.

---

## 3. Inspeções **obrigatoriamente** por oficina nossa (anti-fraude)

Regra dura: um stand **nunca** pode submeter relatório de inspeção, mesmo que ele próprio seja oficina GarageFlow.

**BD — `carity_listings`:** adicionar `requires_independent_inspection BOOLEAN DEFAULT true` quando `seller_id.account_type = 'dealer'`.

**BD — `carity_inspections`:** trigger que bloqueia atribuir `shop_id` em que o owner da shop é o mesmo `seller_id` do listing (ou tem o mesmo NIF).

**Edge function `assign-dealer-inspection`:** ao publicar listing de stand:
1. Marca listing como `pending_independent_inspection`
2. Pega 3 oficinas parceiras mais próximas com KYC OK e disponibilidade, **excluindo** qualquer shop ligada ao stand
3. Cria oferta `carity_inspection_offers` para a 1ª; expira em 24h e passa à seguinte
4. Listing só fica `published` depois do relatório `is_locked = true` por uma oficina independente

**Badge público:** todo carro de stand mostra "Inspeção independente verificada por [Oficina X]" com link para o relatório PDF assinado (hash já existe).

**RLS reforço:** policy em `carity_inspection_reports` que rejeita `submitted_by_user_id` que partilhe `nif` com `seller_id` do listing.

---

## 4. Página pública de cada stand + SEO

**Nova rota `/market/stand/:slug`:**
- Hero com logo, nome, cidade, contagem de carros, rating médio
- Grid de todos os anúncios activos do stand
- Selo "Inspeções independentes garantidas pela GarageFlow"
- Mapa, horários, contacto

**SEO:**
- `<title>` dinâmico: `{Nome do Stand} — Carros Usados em {Cidade} | GarageFlow Market`
- JSON-LD `AutoDealer` + `ItemList` com os carros
- OG image gerada por edge function existente `market-og-image`
- Adicionar todos os stands ao `sitemap-market.xml` via função que regenera

**Index `/market/stands`:** diretório nacional de stands ordenados por reputação (nº inspeções aprovadas, rating).

---

## 5. UI / Dashboard do Stand

Nova rota `/market/dealer-dashboard` (só para `account_type = dealer`):
- KPIs: anúncios activos, vistos, mensagens, vendas, quota usada
- Bulk upload (CSV ou múltiplos carros de uma vez)
- Acesso ao plano e faturas
- Ver inspeções agendadas (sem poder editar relatórios)

CTA na landing `/market`: card extra ao lado de "Para Oficinas" → **"Para Stands"** com pricing e botão "Registar stand".

---

## 6. Detalhes técnicos

```
src/pages/MarketDealerDashboard.tsx           (novo)
src/pages/MarketDealerSignup.tsx              (novo, fluxo dedicado)
src/pages/MarketStandPublic.tsx               (público /market/stand/:slug)
src/pages/MarketStandsDirectory.tsx           (público /market/stands)
src/components/DealerPlanCard.tsx
src/components/DealerInspectionBadge.tsx
supabase/functions/assign-dealer-inspection
supabase/functions/dealer-checkout            (Stripe subscription)
supabase/functions/regenerate-stands-sitemap
```

**Migrações:**
1. Colunas em `carity_seller_profiles` + `carity_listings`
2. Tabela `dealer_plans` com seed por país
3. Trigger anti-fraude em `carity_inspections`
4. RPC `dealer_can_publish` (quota)
5. RLS reforçada em `carity_inspection_reports`

---

## 7. Confirmações antes de implementar

1. **Preços** sugeridos (39 / 99 / 249 €) — OK ou prefere outros?
2. Quero implementar **tudo de uma vez** ou começar pela Fase 1 (conta stand + anti-fraude inspeções) e depois Fase 2 (planos + SEO)?
3. Comissão de venda para stand: **1%** (vs 3% particular) — confirma?
