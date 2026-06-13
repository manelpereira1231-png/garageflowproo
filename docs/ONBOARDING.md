# Onboarding Técnico — Equipa GarageFlow

Bem-vindo. Lê isto antes de tocar em código.

## Stack
- React 18 + Vite + TypeScript + Tailwind v3 + shadcn.
- Backend: Lovable Cloud (Supabase) — Auth, Postgres+RLS, Storage, Edge Functions (Deno).
- Pagamentos: Stripe (subs + Connect para Market escrow).
- PDFs: jsPDF.
- Realtime: Supabase Realtime.

## Convenções obrigatórias
1. **Dois produtos, dois realms:** ERP (`/dashboard`, `/quotes`…) e Market (`/market`, `/carity-*`). Nunca cross-edit. Auth tem clients separados (`storageKey` distinto).
2. **Multi-tenancy:** todas as queries frontend usam `activeShopId` + RLS server-side. Nunca confiar só no frontend.
3. **Roles:** sempre em `user_roles` + `has_role()` SECURITY DEFINER. Nunca na profile.
4. **PT-PT** no painel admin. App tem i18n (PT/EN/ES/BR/IN).
5. **Zero fake UX:** não inventar dados, placeholders ou métricas. Canais não configurados → esconder.
6. **Design tokens** em `index.css`. Nunca hardcode cores (`text-white`, `bg-[#...]`).
7. **Mobile-first**, alvo 44px touch, padrão dual view `hidden sm:block` + `sm:hidden`.

## Setup local
1. Workspace Lovable → abrir projeto.
2. Secrets necessários (Workspace Settings → Build Secrets para Sentry; runtime via tool):
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `LOVABLE_API_KEY`.
3. Migrações: criar via tool `supabase--migration`. Nunca SQL direto.

## Edge Functions
- Pasta `supabase/functions/<name>/index.ts`. CORS obrigatório. `verify_jwt = false` por defeito; validar JWT em código quando necessário.
- Deploy automático.

## Observabilidade
- `/admin/system-health` — saúde global.
- `/admin/business-metrics` — MRR/ARR/Churn/LTV.
- `/admin/action-queue` — workers.
- `/admin/complaints` — SLAs suporte.
- `/admin/rate-limits` — abusos.
- `/status` — público, status em tempo real.
- Sentry: ativo se `VITE_SENTRY_DSN` definido em Build Secrets.

## Cron jobs
- `process-action-queue` — every minute
- `system-maintenance` — hourly
- `system-alerts-every-15min`
- `compute-business-metrics-daily` — 00:30
- `compute-customer-health-hourly`

## Documentos
- `docs/RUNBOOKS.md` — resposta a incidentes.
- `docs/DR_PLAN.md` — recuperação de desastre + RTO/RPO.
- `docs/SLO.md` — alvos de serviço.

## Regras de ouro
- Tudo incremental e seguro.
- Não duplicar sistemas.
- Não quebrar pagamentos/escrow sem teste.
- Auditar antes de alterar.
