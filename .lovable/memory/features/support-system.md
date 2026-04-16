---
name: Sistema de Suporte Visível
description: Canal de suporte unificado entre ERP e Market — tabela support_tickets, página /support com formulário + WhatsApp/email, FAB global, links em footers e auth pages
type: feature
---

# Suporte ao Utilizador — Visível em Ambos os Ecossistemas

## Tabela
`support_tickets` (RLS): qualquer pessoa (anon/auth) pode criar; utilizador autenticado vê os seus; super admin gere todos.

## Pontos de acesso (sempre visíveis)
1. **FAB flutuante** (`SupportFab.tsx`) — botão "Suporte" canto inferior direito, em todas as páginas exceto `/support`, `/reset-password`, `/quote/:token`, `/portal/:token`. Detecta contexto (`/market` → context=market, senão context=erp).
2. **Footers**: LandingLayout (ERP), CarityMarketplace (Market), LegalFooter (todas as páginas legais).
3. **Auth pages**: Auth.tsx e MarketAuth.tsx têm link "Suporte" nos rodapés legais.

## Página `/support`
- Formulário completo (categoria, urgência, plataforma erp/market) que insere em `support_tickets`.
- Pré-preenche email e nome se utilizador autenticado.
- Contactos diretos: email `manelpereira11@gmail.com` + WhatsApp `+351933683304`.
- Link `?context=market` força contexto Market.

## Cobertura
- ERP autenticado (FAB) ✓
- ERP público / landing (footer + FAB) ✓
- Market público (footer + FAB) ✓
- Market autenticado (FAB) ✓
- Auth pages (link inline) ✓
- Páginas legais (LegalFooter) ✓
