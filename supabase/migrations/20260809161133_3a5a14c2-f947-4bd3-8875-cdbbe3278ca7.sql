ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.shops.onboarding_completed_at IS
  'Fonte de verdade única do estado de onboarding. NULL = onboarding pendente.';

-- Backfill seguro: todas as oficinas já existentes são consideradas configuradas,
-- para que nenhum utilizador atual seja enviado para /onboarding.
UPDATE public.shops
   SET onboarding_completed_at = COALESCE(onboarding_completed_at, created_at, now())
 WHERE onboarding_completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shops_user_onboarding
  ON public.shops (user_id, onboarding_completed_at);