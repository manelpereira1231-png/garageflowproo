
-- Create appointments table
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  service_type text NOT NULL DEFAULT '',
  date date NOT NULL,
  time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  client_name text,
  client_phone text,
  client_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS: shop members manage their appointments
CREATE POLICY "Shop members manage appointments"
  ON public.appointments FOR ALL
  TO authenticated
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- RLS: public can insert appointments (for online booking)
CREATE POLICY "Public can create appointments"
  ON public.appointments FOR INSERT
  TO anon
  WITH CHECK (true);

-- RLS: public can read shop info for booking page
-- (shops already has a public policy for quotes, reuse pattern)

-- Add slug column to shops for public booking URL
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Create function to generate slug from shop name
CREATE OR REPLACE FUNCTION public.generate_shop_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  base_slug text;
  new_slug text;
  counter int := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := lower(regexp_replace(regexp_replace(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
    IF base_slug = '' THEN
      base_slug := 'oficina';
    END IF;
    new_slug := base_slug;
    LOOP
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.shops WHERE slug = new_slug AND id != NEW.id);
      counter := counter + 1;
      new_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := new_slug;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_shop_slug
  BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_shop_slug();

-- Generate slugs for existing shops
UPDATE public.shops SET slug = NULL WHERE slug IS NULL;

-- Allow anon to read shops by slug (for booking page)
CREATE POLICY "Public shop access by slug"
  ON public.shops FOR SELECT
  TO anon
  USING (slug IS NOT NULL);
