CREATE OR REPLACE FUNCTION public.vehicle_lookup_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT (value->>'enabled')::boolean FROM platform_settings WHERE key = 'vehicle_lookup'), true)
$$;
GRANT EXECUTE ON FUNCTION public.vehicle_lookup_enabled() TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_vehicle_lookup_settings_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.key = 'vehicle_lookup' AND (TG_OP = 'INSERT' OR NEW.value IS DISTINCT FROM OLD.value) THEN
    INSERT INTO audit_logs(action, entity_type, user_id, details)
    VALUES ('vehicle_lookup_settings', 'platform_settings', auth.uid(),
      jsonb_build_object('before', CASE WHEN TG_OP = 'UPDATE' THEN OLD.value ELSE NULL END, 'after', NEW.value));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_vehicle_lookup_settings_audit ON public.platform_settings;
CREATE TRIGGER trg_vehicle_lookup_settings_audit AFTER INSERT OR UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_vehicle_lookup_settings_audit();

CREATE OR REPLACE FUNCTION public.tg_vehicle_lookup_limits_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO audit_logs(action, entity_type, entity_id, user_id, details)
  VALUES ('vehicle_lookup_shop_limit', 'shop',
    COALESCE(NEW.shop_id, OLD.shop_id), auth.uid(),
    jsonb_build_object('op', TG_OP,
      'before', CASE WHEN TG_OP <> 'INSERT' THEN jsonb_build_object('monthly_limit', OLD.monthly_limit, 'blocked', OLD.blocked) END,
      'after', CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('monthly_limit', NEW.monthly_limit, 'blocked', NEW.blocked) END));
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_vehicle_lookup_limits_audit ON public.vehicle_lookup_limits;
CREATE TRIGGER trg_vehicle_lookup_limits_audit AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_lookup_limits
FOR EACH ROW EXECUTE FUNCTION public.tg_vehicle_lookup_limits_audit();