CREATE OR REPLACE FUNCTION public.get_client_portal_services(_token uuid)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sc.id, sc.name
  FROM public.clients c
  JOIN public.service_catalog sc ON sc.shop_id = c.shop_id
  WHERE c.portal_token = _token
    AND c.deleted_at IS NULL
    AND coalesce(sc.active, true)
  ORDER BY sc.name;
$$;
REVOKE ALL ON FUNCTION public.get_client_portal_services(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_client_portal_services(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_appointment_service_shop()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_catalog WHERE id = NEW.service_id AND shop_id = NEW.shop_id
  ) THEN
    RAISE EXCEPTION 'Service does not belong to this shop';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_appointment_service_shop ON public.appointments;
CREATE TRIGGER trg_validate_appointment_service_shop
BEFORE INSERT OR UPDATE OF service_id, shop_id ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_service_shop();