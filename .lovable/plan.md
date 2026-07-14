
# Plano: Sistema de Equipa, Perfis, Permissões e Email de Fatura

Antes de tocar em código, preciso confirmar o âmbito. Este é um bloco grande e prefiro alinhar contigo para não fazer trabalho a mais nem partir o que já funciona.

## 1. Auditoria (sem alterações)

Vou primeiro ler e mapear:
- `useShopRole.ts`, `rolePaths.ts`, `RoleProtectedRoute` (App.tsx), `Layout.tsx`, `CommandPalette.tsx`
- `AcceptInvite.tsx` + Edge Function do convite + tabela `team_invitations`
- Função `has_capability` na BD + RLS de tabelas críticas (invoices, payments, suppliers, shops, user_roles)
- Fluxo atual de emissão/pagamento de fatura em `Invoices.tsx` + `invoiceEmailHtml`

Entrego um relatório curto do que está OK vs. em falta antes de mexer.

## 2. Convite — corrigir "Invalid login credentials"

Causa provável: mesmo com `auto_confirm_email=true`, o `signInWithPassword` corre antes do user ser materializado, ou o `signUp` está a devolver "user already exists" (convite reenviado) e cai no fallback.

Correção:
- `AcceptInvite.tsx`: após `signUp` bem sucedido, usar a `session` devolvida diretamente (não voltar a chamar `signInWithPassword`). Se `session` for null, aí sim tentar login.
- Se `signUp` devolver "already registered", chamar `signInWithPassword` com a password nova só se o convite ainda estiver `pending` (senão pedir reset).
- Só depois de haver sessão válida: consumir o convite via RPC `accept_team_invitation` (SECURITY DEFINER) que insere em `shop_users` + `user_roles` atomicamente e marca convite como `accepted`.
- Redirect final via `rolePaths` conforme role.

## 3. Matriz de permissões — congelar definição

Perfis: `owner`, `admin`, `manager`, `reception`, `technician`, `sales`.

Capabilities (exemplo — vou apresentar tabela final na implementação):

```text
                owner admin manager reception technician sales
dashboard.full    x     x      -        -          -       -
dashboard.ops     x     x      x        -          -       -
dashboard.desk    x     x      x        x          -       -
dashboard.tech    x     x      x        -          x       -
dashboard.sales   x     x      x        -          -       x
clients.rw        x     x      x        x          -       x
clients.read      x     x      x        x          x(own)  x
vehicles.rw       x     x      x        x          -       x
workorders.rw     x     x      x        x          x(own)  -
workorders.exec   -     -      -        -          x       -
quotes.rw         x     x      x        x          -       x
invoices.rw       x     x      -        -          -       -
payments.rw       x     x      -        x(cash)    -       -
stock.rw          x     x      x        -          -       -
purchases.rw      x     x      x        -          -       -
suppliers.rw      x     x      x        -          -       -
finance.view      x     x      -        -          -       -
marketplace.mng   x     x      -        -          -       x
team.rw           x     x(-owner) -     -          -       -
settings.rw       x     x(-critical) -   -          -       -
shop.delete       x     -      -        -          -       -
```

Aplicada em três camadas:
1. **Frontend**: `useCapability(cap)` → sidebar, botões, rotas (`RoleProtectedRoute`).
2. **RPC `has_capability(uid, cap)`** SECURITY DEFINER na BD.
3. **RLS**: policies das tabelas sensíveis chamam `has_capability`.

## 4. Sidebar e Dashboard por perfil

- Sidebar construída a partir da matriz (nunca só `hidden`).
- Rotas de dashboard: `/dashboard` faz redirect interno para `/dashboard/owner|ops|desk|tech|sales` conforme role.
- Cada dashboard já existe em partes — vou reutilizar componentes, não criar novos widgets.

## 5. Segurança de URLs

- `RoleProtectedRoute` já existe → reforçar para redirecionar em vez de mostrar 404.
- RLS complementa: mesmo com URL manual, queries devolvem vazio/erro.

## 6. Painel de Equipa (owner/admin)

Em `Team.tsx` (existente), garantir:
- convidar / reenviar / cancelar convite
- mudar role
- desativar / reativar / remover
- último login (via `auth.users.last_sign_in_at` exposto por view)
- estado do convite

## 7. Email automático de fatura paga

Verificar se já existe trigger. Se sim, garantir que envia o template `paid` com **todas as linhas discriminadas** (não só total). Se não existe:
- Ao marcar fatura como `paid` em `Invoices.tsx` → chamar `sendInvoiceByEmail` com `status='paid'` já automaticamente (já implementado parcialmente na sessão anterior).
- Melhorar `invoiceEmailHtml` para incluir tabela de itens (descrição, qtd, preço unit., IVA, total linha) igual ao orçamento — reutilizando o mesmo componente de tabela.

## 8. Testes finais

Playwright headless para cada role: aceitar convite → login → dashboard correto → tentar aceder URL proibido → verificar bloqueio.

---

## Estimativa

Isto são **múltiplas migrations + ~10 ficheiros frontend + template email + testes**. Provavelmente 2–3 turnos grandes.

## Perguntas antes de avançar

1. Confirmas a matriz de capabilities acima? Alguma célula errada?
2. **Manager** — confirmas que NÃO vê faturação/finance? (é comum managers verem)
3. **Reception** pode registar pagamentos em dinheiro? (assumi que sim)
4. Queres que faça isto num só turno grande (mais lento, mais risco) ou fase a fase (convite+segurança → matriz+sidebar → dashboards → email)?

Assim que respondas avanço com a auditoria concreta ao código atual e a implementação.
