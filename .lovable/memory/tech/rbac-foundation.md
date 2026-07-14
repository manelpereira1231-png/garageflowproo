---
name: RBAC foundation
description: Central capability-based RBAC — 6 shop roles, has_capability() SQL, RESTRICTIVE policies, fail-closed route guard, role-specific dashboards
type: feature
---
# RBAC Foundation (post-audit — 2026-07)

## Roles
6 papéis em `shop_users.role` (CHECK constraint): `owner, admin, manager, reception, commercial, technician`. Plus `super_admin` via `user_roles` (plataforma).

## Capability map — fonte dupla mantida em sync
- **Frontend**: `src/hooks/useShopRole.ts` — tipo `Capability` + `MATRIX` + `can()`.
- **Backend**: `public.has_capability(_shop_id, _cap)` SQL SECURITY DEFINER.
- Alterar capacidades → tocar SEMPRE nos dois.
- Capacidades granulares por operação: `*.view/create/edit/delete/export/print/send_email/send_whatsapp/cancel/approve/complete`.

## Enforcement layers
1. **RLS RESTRICTIVE** (fonte de verdade) em `clients`, `vehicles`, `quotes`, `work_orders`, `invoices`, `payments` — INSERT/UPDATE/DELETE gated por `has_capability()`. Layered em cima das políticas PERMISSIVE de `shop_id`.
2. **Route guard** — `src/lib/rolePaths.ts` fail-closed: rotas não mapeadas → NEGAR. Lista `ALWAYS_ALLOWED` para partilhados (`/profile`, `/notifications`, `/onboarding`, `/support`, `/accept-invite`).
3. **Sidebar/CommandPalette** — filtram automaticamente via `canOpenPath()`. CommandPalette também filtra queries de entidades por capability antes de ir à BD.
4. **Componente `<Can>`** (`src/components/rbac/Can.tsx`) — para envolver botões/tabs/exports. Suporta `capability`, `all`, `any`, `fallback`. Hook `useCan()` para uso imperativo.

## Dashboards por role
`src/pages/Dashboard.tsx` é dispatcher:
- `technician` → `TechnicianDashboard` (serviços hoje, atrasos, em curso)
- `reception` → `ReceptionDashboard` (agenda, check-in/out, clientes novos)
- `commercial` → `CommercialDashboard` (pipeline, conversão, orçamentos abertos)
- `owner/admin/manager/super_admin` → `OwnerDashboard` (KPIs completos, revenue, gráficos)

## homeForRole redirect
`src/lib/rolePaths.ts:homeForRole()` — técnico→`/workshop`, receção→`/agenda`, comercial→`/clients`, outros→`/dashboard`.

## Regra crítica
Nunca confiar apenas em UI/sidebar/palette. Se adicionares nova operação sensível, adiciona RESTRICTIVE policy usando `has_capability()` e mapeia capability na MATRIX + SQL function.
