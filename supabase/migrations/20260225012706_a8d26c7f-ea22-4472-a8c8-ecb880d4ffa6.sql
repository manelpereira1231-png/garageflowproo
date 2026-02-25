
-- Add missing columns to shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Lisbon';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
