---
name: Admin Marketing Campaigns
description: Sistema global de campanhas de email do super admin para todos os utilizadores ERP + Market
type: feature
---
O painel `/admin/marketing` permite ao super admin criar e enviar campanhas de email em massa para todo o ecossistema GarageFlow (ERP + Market).

**Tabelas:**
- `admin_campaigns`: nome, assunto, content_html, audience, country_filter, status (draft/sending/sent/failed), contadores
- `admin_campaign_recipients`: regista cada destinatário individual com estado e timestamps

**Audiências suportadas:**
- `all` — todos (ERP + Market)
- `erp` / `erp_free` / `erp_paid` — segmentação por plano de oficina
- `market` / `market_sellers` / `market_buyers` — utilizadores do Market

**Edge Function:** `admin-send-campaign` valida super admin (manelpereira11@gmail.com), constrói lista deduplicada de emails consultando `shops` (ERP), `carity_seller_profiles` (sellers) e `market_escrow.buyer_id` (buyers), envia via Resend a partir de `noreply@garageflow.pt` com throttling de 110ms entre envios.

**RLS:** apenas super admin pode ler/escrever ambas as tabelas.

**Filtro por país:** opcional via campo `country_filter` (código ISO 2 letras), aplica-se a `shops.country` e `carity_seller_profiles.country_code`.
