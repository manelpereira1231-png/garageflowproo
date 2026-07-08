ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS labor_hours NUMERIC DEFAULT 0;
UPDATE public.quotes SET labor_hours = 0 WHERE labor_hours IS NULL;
ALTER TABLE public.quotes ALTER COLUMN labor_hours SET NOT NULL;