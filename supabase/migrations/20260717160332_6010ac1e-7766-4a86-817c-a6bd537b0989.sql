
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS cta_label     text,
  ADD COLUMN IF NOT EXISTS cta_url       text,
  ADD COLUMN IF NOT EXISTS badge_label   text,
  ADD COLUMN IF NOT EXISTS show_button   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_price    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_trial    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_badge    boolean NOT NULL DEFAULT true;

-- Nada mais é necessário: RLS já existe em public.plans e não muda.
COMMENT ON COLUMN public.plans.cta_label IS
  'Texto do botão principal do plano. Se NULL/empty, é derivado automaticamente do cta_mode + nome do plano (ex.: "Testar Plano <Nome>").';
COMMENT ON COLUMN public.plans.cta_url IS
  'URL de destino quando cta_mode = ''custom_url''. Ignorado nos restantes modos.';
COMMENT ON COLUMN public.plans.badge_label IS
  'Etiqueta a mostrar no selo do cartão (ex.: "Mais Popular"). Só aparece se show_badge=true.';
