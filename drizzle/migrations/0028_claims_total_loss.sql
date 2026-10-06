ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS total_loss boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_loss_date date,
  ADD COLUMN IF NOT EXISTS vehicle_market_value numeric,
  ADD COLUMN IF NOT EXISTS salvage_value numeric,
  ADD COLUMN IF NOT EXISTS indemnity_amount numeric,
  ADD COLUMN IF NOT EXISTS client_decision text,
  ADD COLUMN IF NOT EXISTS client_decision_date date,
  ADD COLUMN IF NOT EXISTS total_loss_notes text;
ALTER TABLE public.claims ADD CONSTRAINT claims_client_decision_chk
  CHECK (client_decision IS NULL OR client_decision IN ('pending','keep_salvage','deliver_insurer','repair_own_cost'));