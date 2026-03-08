
-- Fix security: set search_path on generate_shop_slug
CREATE OR REPLACE FUNCTION public.generate_shop_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
