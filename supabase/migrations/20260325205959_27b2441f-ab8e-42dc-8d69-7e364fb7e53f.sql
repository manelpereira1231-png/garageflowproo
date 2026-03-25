ALTER TABLE public.partners 
  ADD COLUMN IF NOT EXISTS payout_holder_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payout_iban text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payout_mbway_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payout_bank text DEFAULT '';