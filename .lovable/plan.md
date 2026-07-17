# Acesso Independente para Oficinas Filhas

Hoje, uma oficina filha é criada com `shops.user_id = <id da oficina mãe>`, ou seja, é apenas mais uma oficina do mesmo utilizador. Não existe login próprio. Vamos passar a criar uma **conta Auth dedicada** para cada oficina filha, mantendo a mãe com poder total de gestão mas **sem partilhar credenciais**.

## Novo modelo de propriedade

- Cada oficina passa a ter um **owner auth próprio** (`shops.user_id` = utilizador dessa oficina).
- A ligação ao grupo passa por uma **nova coluna** `shops.group_owner_id` (uuid, references `auth.users`) — sempre igual ao `user_id` da Oficina Mãe.
- Oficina Mãe: `group_owner_id = user_id = <auth do fundador>`.
- Oficina Filha: `group_owner_id = <auth do fundador>`, `user_id = <auth dedicado da filha>`.

Backfill: para todas as shops existentes, `group_owner_id := user_id` (comportamento atual preservado).

## Fluxo de criação (novo)

1. Mãe abre "Criar Oficina" → preenche **nome** + **email do responsável da filha**.
2. Frontend chama edge function `invite-child-shop` (service role) que:
   a. Valida que o chamador é dono do grupo e que o limite do plano permite.
   b. Cria `shops` com `user_id = temp placeholder` — na verdade, faz tudo numa transação server-side (SQL RPC ou dentro da edge function): chama `supabase.auth.admin.inviteUserByEmail(email, { redirectTo: "https://www.garageflow.pt/auth/set-password" })`.
   c. Recebe o `user.id` do convite.
   d. Insere `shops` com `user_id = <novo user>`, `group_owner_id = auth.uid() do chamador`, `name = ...`, herda plano/subscrição (trigger `handle_new_shop_subscription` já preparado).
   e. Insere `shop_users(shop_id, user_id=<novo>, role='owner')`.
3. Supabase envia o email de convite (template `invite`) com o link assinado.
4. Utilizador da filha clica → página `/auth/set-password` (nova) → define password → sessão válida → entra direto na sua oficina.

## Isolamento (RLS)

Ajustes mínimos — a maioria já está protegida por `user_id`/membership:
- `shops` policies mantêm `user_id = auth.uid()` para o dono direto. Mãe deixa de "ver" a filha por posse; passa a ver por **`group_owner_id = auth.uid()`** (nova policy adicional só para leitura/gestão de grupo).
- Nova função `is_group_owner(_shop_id)` SECURITY DEFINER para triggers/policies de gestão.
- Todas as tabelas operacionais (clients, vehicles, quotes, invoices, etc.) continuam scoped por `shop_id` via `shop_users` → automaticamente isoladas. A mãe **não** recebe membership nas filhas.
- Frontend: `usePrimaryShopId` passa a devolver a shop cujo `id = user_id = auth.uid()` (ou seja, a filha só vê a sua). `useShopContext` já filtra por owned+member; para a filha só existirá 1 shop → `ShopSwitcher` continua oculto (regra `shops.length <= 1` já implementada).

## Gestão pela Mãe

Continua a funcionar via `useOwnedShops`, mas passa a consultar por `group_owner_id = auth.uid()` em vez de `user_id`. Ações permitidas:
- Criar filha (fluxo acima).
- Eliminar filha (`delete_child_shop` RPC — ajustar check para `group_owner_id`).
- **Reenviar convite**: novo botão no diálogo "Gerir Oficinas" → chama edge function `resend-child-invite` que faz `auth.admin.generateLink({ type: 'invite' | 'recovery' })` e reenvia email.
- Suspender: flag `shops.suspended_at` (nova) — quando marcada, `shop_users` policies negam acesso ao dono da filha. Mãe pode reativar.

Mãe **nunca** vê/define a password — apenas dispara convites/recovery.

## Página de definição de password

Nova rota pública `/auth/set-password`:
- Lê `type=invite` ou `type=recovery` do hash Supabase.
- Formulário simples: nova password + confirmação → `supabase.auth.updateUser({ password })`.
- Após sucesso → redireciona para `/dashboard`.

## Emails

Usar o template **invite** oficial do Supabase Auth. Se o projeto já tem `auth-email-hook` scaffolded, personalizar o `.tsx` `invite` com o copy pedido (assunto: "Foi convidado para aceder ao GarageFlow", link "Definir Palavra-passe", nota "Se não reconhece este convite, ignore este email"). Nunca enviar passwords em texto.

## Migração de dados existentes

- Backfill `group_owner_id = user_id` em todas as shops.
- Shops filhas atuais (mesmo `user_id` da mãe) permanecem como estão — o fundador continua a ser dono técnico. Para lhes dar acesso independente **pode-se, opcionalmente**, correr no Admin "Emancipar oficina" → dispara `invite-child-shop-existing` que cria conta separada e transfere `user_id`.

## Ficheiros afetados (resumo técnico)

- **SQL migration**: coluna `shops.group_owner_id` + backfill + índice; função `is_group_owner`; ajuste `delete_child_shop`, `check_shop_creation_limit`, `get_shop_creation_status` para usar `group_owner_id`; nova policy `shops_group_owner_read` (SELECT) para a mãe ver shops do grupo; coluna `shops.suspended_at` (nullable).
- **Edge functions**: `supabase/functions/invite-child-shop/index.ts`, `supabase/functions/resend-child-invite/index.ts` (service role).
- **Frontend**:
  - `src/components/ShopSwitcher.tsx` — troca `insert shops` por `functions.invoke('invite-child-shop')`; adiciona ação "Reenviar convite".
  - `src/hooks/useOwnedShops.ts` / `usePrimaryShopId.ts` — query por `group_owner_id`.
  - `src/pages/AuthSetPassword.tsx` (novo) + rota em `App.tsx`.
  - Ajuste do template invite em `supabase/functions/_shared/email-templates/invite.tsx` (se existir; caso contrário scaffold).

## Testes (checklist)

Criação → email chega → set-password → login → só vê a sua oficina → mãe vê ambas → mãe reenvia convite → mãe elimina → link expirado pede novo convite.

---

**Confirmar antes de avançar:**
1. OK adicionar `group_owner_id` (nova coluna, backfill seguro)?
2. Mãe passa a **não ter** acesso operacional aos dados da filha (só gestão). Correto? Ou queres que mãe também consiga entrar na oficina filha como super-owner?
3. Oficinas filhas existentes: deixar como estão (posse do fundador) ou migrar todas para contas independentes agora?
