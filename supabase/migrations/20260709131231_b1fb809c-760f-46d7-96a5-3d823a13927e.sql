
CREATE OR REPLACE FUNCTION public.link_shop_to_crm_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_lead_id uuid;
BEGIN
  IF NEW.email IS NULL AND NEW.phone IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO matched_lead_id
  FROM public.crm_leads
  WHERE shop_link_id IS NULL
    AND (
      (NEW.email IS NOT NULL AND lower(email) = lower(NEW.email))
      OR (NEW.phone IS NOT NULL AND regexp_replace(coalesce(phone,''), '\D', '', 'g') = regexp_replace(NEW.phone, '\D', '', 'g'))
    )
  ORDER BY created_at ASC
  LIMIT 1;

  IF matched_lead_id IS NOT NULL THEN
    UPDATE public.crm_leads
    SET shop_link_id = NEW.id,
        shop_id = NEW.id,
        pipeline_stage = 'customer',
        status = 'won',
        updated_at = now()
    WHERE id = matched_lead_id;

    INSERT INTO public.crm_activity (lead_id, shop_id, kind, summary, meta)
    VALUES (
      matched_lead_id,
      NEW.id,
      'converted',
      'Oficina registou-se no GarageFlow — convertida em cliente',
      jsonb_build_object('shop_id', NEW.id, 'shop_name', NEW.name)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_shop_to_crm_lead ON public.shops;
CREATE TRIGGER trg_link_shop_to_crm_lead
  AFTER INSERT ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.link_shop_to_crm_lead();
