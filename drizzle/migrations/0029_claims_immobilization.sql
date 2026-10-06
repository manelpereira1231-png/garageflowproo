ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS vehicle_in_date date,
  ADD COLUMN IF NOT EXISTS vehicle_out_date date,
  ADD COLUMN IF NOT EXISTS promised_date date,
  ADD COLUMN IF NOT EXISTS client_informed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_informed_note text;