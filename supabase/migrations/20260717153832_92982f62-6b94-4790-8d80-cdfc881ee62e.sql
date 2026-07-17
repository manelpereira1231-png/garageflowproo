
-- Add configurable CTA button mode to plans, driven by Super Admin.
-- Values:
--   'checkout'    → open Stripe checkout (default paid flow)
--   'trial'       → start free trial signup
--   'demo'        → book a demo (currently used by Garage / Enterprise)
--   'contact'     → contact sales
--   'unavailable' → hide the CTA (plan is showcase-only)
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS cta_mode text NOT NULL DEFAULT 'trial';

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_cta_mode_check;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_cta_mode_check
  CHECK (cta_mode IN ('checkout','trial','demo','contact','unavailable'));

-- Sensible defaults for existing plans (Garage/Enterprise → demo).
UPDATE public.plans SET cta_mode = 'demo'
  WHERE slug IN ('garage','enterprise') AND cta_mode = 'trial';
