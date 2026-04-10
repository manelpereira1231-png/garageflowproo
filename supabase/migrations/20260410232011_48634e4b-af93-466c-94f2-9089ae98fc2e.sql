
-- Add discount columns to subscriptions table
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS discount_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS discount_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS discount_applied_by uuid,
  ADD COLUMN IF NOT EXISTS discount_expires_at timestamptz;
