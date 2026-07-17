
-- Corrige o RPC de limite de oficinas (coluna correta é user_id, não owner_id)
CREATE OR REPLACE FUNCTION public.check_shop_creation_limit(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current int; v_plan text; v_max int;
BEGIN
  SELECT COUNT(*) INTO v_current FROM public.shops WHERE user_id = _user_id;
  SELECT s.plan INTO v_plan
    FROM public.subscriptions s
    JOIN public.shops sh ON sh.id = s.shop_id
    JOIN public.plans p ON p.slug = s.plan
    WHERE sh.user_id = _user_id
    ORDER BY p.sort_order DESC LIMIT 1;
  IF v_plan IS NULL THEN v_plan := 'free'; END IF;
  SELECT COALESCE((limits->>'max_shops')::int, 1) INTO v_max FROM public.plans WHERE slug = v_plan;
  RETURN (v_max < 0) OR (v_current < v_max);
END $function$;

CREATE OR REPLACE FUNCTION public.get_shop_creation_status(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current int; v_plan text; v_max int;
BEGIN
  SELECT COUNT(*) INTO v_current FROM public.shops WHERE user_id = _user_id;
  SELECT s.plan INTO v_plan
    FROM public.subscriptions s
    JOIN public.shops sh ON sh.id = s.shop_id
    JOIN public.plans p ON p.slug = s.plan
    WHERE sh.user_id = _user_id
    ORDER BY p.sort_order DESC LIMIT 1;
  IF v_plan IS NULL THEN v_plan := 'free'; END IF;
  SELECT COALESCE((limits->>'max_shops')::int, 1) INTO v_max FROM public.plans WHERE slug = v_plan;
  RETURN jsonb_build_object(
    'allowed', (v_max < 0) OR (v_current < v_max),
    'current', v_current, 'max', v_max, 'plan', v_plan
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.check_shop_creation_limit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_shop_creation_status(uuid) TO authenticated, service_role;

-- Trigger de DB: impede a criação de uma oficina acima do limite do plano,
-- mesmo que o pedido chegue pela Data API/REST/edge functions ou insert direto.
-- Super admins são isentos (para operações administrativas).
CREATE OR REPLACE FUNCTION public.enforce_shop_creation_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status jsonb;
  v_is_super boolean := false;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Isenção para super admin (auth.uid()) quando executado em contexto autenticado
  BEGIN
    SELECT public.is_super_admin(auth.uid()) INTO v_is_super;
  EXCEPTION WHEN OTHERS THEN
    v_is_super := false;
  END;
  IF v_is_super THEN
    RETURN NEW;
  END IF;

  v_status := public.get_shop_creation_status(NEW.user_id);
  IF NOT COALESCE((v_status->>'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'SHOP_LIMIT_REACHED: max % oficinas atingido no plano %',
      v_status->>'max', v_status->>'plan'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS enforce_shop_creation_limit_trigger ON public.shops;
CREATE TRIGGER enforce_shop_creation_limit_trigger
  BEFORE INSERT ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_shop_creation_limit();
