
-- Add location coordinates to shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS longitude numeric;

-- Add scheduling and communication fields to carity_inspections
ALTER TABLE public.carity_inspections ADD COLUMN IF NOT EXISTS scheduled_date date;
ALTER TABLE public.carity_inspections ADD COLUMN IF NOT EXISTS scheduled_time time;
ALTER TABLE public.carity_inspections ADD COLUMN IF NOT EXISTS seller_contacted_at timestamptz;
ALTER TABLE public.carity_inspections ADD COLUMN IF NOT EXISTS seller_notified boolean NOT NULL DEFAULT false;
