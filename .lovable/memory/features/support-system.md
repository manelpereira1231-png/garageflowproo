---
name: Sistema de Suporte Visível
description: Canal de suporte unificado entre ERP e Market — tabela support_tickets, página /support com formulário + WhatsApp/email, FAB global, painel admin /admin/support, edge function notify-support-ticket envia email a manelpereira11@gmail.com em cada novo ticket
type: feature
---

# Suporte ao Utilizador — Visível em Ambos os Ecossistemas

## Tabela
`support_tickets` (RLS): qualquer pessoa (anon/auth) pode criar; utilizador autenticado vê os seus; super admin gere todos. Inclui `admin_response`, `responded_at`, `responded_by`, `status` (open/in_progress/resolved/closed).

## Pontos de acesso (sempre visíveis)
1. **FAB flutuante** (`SupportFab.tsx`) — botão "Suporte" canto inferior direito, em todas as páginas exceto `/support`, `/reset-password`, `/quote/:token`, `/portal/:token`. Detecta contexto (`/market` → context=market, senão context=erp).
2. **Footers**: LandingLayout (ERP), CarityMarketplace (Market), LegalFooter (todas as páginas legais).
3. **Auth pages**: Auth.tsx e MarketAuth.tsx têm link "Suporte" nos rodapés legais.

## Página `/support`
- Formulário completo (categoria, urgência, plataforma erp/market) que insere em `support_tickets`.
- Pré-preenche email e nome se utilizador autenticado.
- Após insert, invoca `notify-support-ticket` (não bloqueante) para enviar email ao admin.
- Contactos diretos: email `manelpereira11@gmail.com` + WhatsApp `+351933683304`.

## Notificação ao admin (centralizado)
- Edge function `notify-support-ticket` (verify_jwt=false) envia email via Resend para `manelpereira11@gmail.com` com:
  - Subject: `[ERP|Market] [PRIORIDADE] Assunto`
  - Reply-To: email do utilizador (resposta direta)
  - Link para `/admin/support`
- Toda mensagem de suporte vai SEMPRE para o painel admin + email do administrador. Nunca para outro lado.

## Painel admin `/admin/support`
- Lista todos os tickets com filtros (status, contexto, pesquisa) e stats (total, abertos, urgentes, resolvidos).
- Realtime via supabase channel — atualiza automaticamente quando novos tickets chegam.
- Modal de detalhe: ver mensagem, mudar status, escrever resposta/notas, marcar resolvido, abrir cliente de email.
- Item adicionado ao AdminLayout em "Operações" com ícone LifeBuoy.

## Cobertura
- ERP autenticado (FAB) ✓
- ERP público / landing (footer + FAB) ✓
- Market público (footer + FAB) ✓
- Market autenticado (FAB) ✓
- Auth pages (link inline) ✓
- Páginas legais (LegalFooter) ✓
- Admin recebe email + vê tudo no painel ✓
