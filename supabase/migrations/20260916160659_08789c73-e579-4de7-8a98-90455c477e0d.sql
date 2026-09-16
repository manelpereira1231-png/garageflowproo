ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;