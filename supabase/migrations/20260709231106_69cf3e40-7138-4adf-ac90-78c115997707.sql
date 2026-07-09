
-- =========================================================
-- LOTE A: Unificação de contas ERP ↔ Marketplace
-- =========================================================

-- 1) RPC idempotente para uma oficina activar o Marketplace
CREATE OR REPLACE FUNCTION public.activate_marketplace_for_shop(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop record;
  v_profile_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = _shop_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shop_not_found';
  END IF;

  -- Só o dono da oficina pode activar
  IF v_shop.user_id <> v_uid THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  -- Cria (ou reaproveita) o perfil de vendedor associado ao mesmo user_id
  SELECT id INTO v_profile_id
  FROM public.carity_seller_profiles
  WHERE user_id = v_uid
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    INSERT INTO public.carity_seller_profiles (
      user_id, name, phone, location, address, nif, country_code, account_type
    ) VALUES (
      v_uid,
      COALESCE(NULLIF(v_shop.name, ''), 'Oficina'),
      COALESCE(v_shop.phone, ''),
      COALESCE(v_shop.address, ''),
      COALESCE(v_shop.address, ''),
      NULLIF(v_shop.nif, ''),
      COALESCE(v_shop.country_code, 'PT'),
      'particular'
    )
    RETURNING id INTO v_profile_id;
  END IF;

  -- Concede roles Market (idempotente)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'buyer'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'seller'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Activa a oficina como parceira de inspecções (opcional, mantém default se já activo)
  UPDATE public.shops
  SET is_carity_partner = true, carity_active = true
  WHERE id = _shop_id AND is_carity_partner = false;

  RETURN jsonb_build_object(
    'ok', true,
    'profile_id', v_profile_id,
    'shop_id', _shop_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_marketplace_for_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_marketplace_for_shop(uuid) TO authenticated;


-- 2) Sync trigger: shops -> carity_seller_profiles (mesmo dono)
CREATE OR REPLACE FUNCTION public.sync_shop_to_seller_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.carity_seller_profiles
  SET
    name = CASE WHEN NEW.name IS NOT NULL AND NEW.name <> '' THEN NEW.name ELSE name END,
    phone = COALESCE(NULLIF(NEW.phone, ''), phone),
    address = COALESCE(NULLIF(NEW.address, ''), address),
    location = COALESCE(NULLIF(NEW.address, ''), location),
    nif = COALESCE(NULLIF(NEW.nif, ''), nif),
    country_code = COALESCE(NEW.country_code, country_code)
  WHERE user_id = NEW.user_id
    -- só sincroniza quando o perfil é o do dono da oficina (não dealers profissionais)
    AND account_type = 'particular';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_shop_to_seller_profile ON public.shops;
CREATE TRIGGER trg_sync_shop_to_seller_profile
AFTER UPDATE OF name, phone, address, nif, country_code ON public.shops
FOR EACH ROW
WHEN (
  OLD.name IS DISTINCT FROM NEW.name OR
  OLD.phone IS DISTINCT FROM NEW.phone OR
  OLD.address IS DISTINCT FROM NEW.address OR
  OLD.nif IS DISTINCT FROM NEW.nif OR
  OLD.country_code IS DISTINCT FROM NEW.country_code
)
EXECUTE FUNCTION public.sync_shop_to_seller_profile();


-- =========================================================
-- LOTE B: Rate-limit utilitário (login, reset, endpoints públicos)
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_and_bump_rate_limit(
  _identifier text,
  _action text,
  _max integer,
  _window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - make_interval(secs => _window_seconds);
  v_count integer;
BEGIN
  IF _identifier IS NULL OR length(_identifier) = 0 OR _action IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'count', 0);
  END IF;

  SELECT COALESCE(SUM(count), 0)::int INTO v_count
  FROM public.rate_limits
  WHERE identifier = _identifier
    AND action_type = _action
    AND window_start >= v_since;

  IF v_count >= _max THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'count', v_count,
      'max', _max,
      'retry_after_seconds', _window_seconds
    );
  END IF;

  INSERT INTO public.rate_limits (identifier, action_type, count, window_start)
  VALUES (_identifier, _action, 1, now());

  -- Limpeza oportunista de linhas antigas (>7 dias)
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '7 days'
    AND random() < 0.01;

  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1, 'max', _max);
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_bump_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_bump_rate_limit(text, text, integer, integer) TO service_role;
