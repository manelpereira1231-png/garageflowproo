
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can delete own roles" ON public.user_roles;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Super admin manages user roles') THEN
    CREATE POLICY "Super admin manages user roles" ON public.user_roles
      FOR ALL TO authenticated
      USING (public.is_super_admin(auth.uid()))
      WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;
END $$;

DROP POLICY IF EXISTS "Users manage own trust score" ON public.seller_trust_scores;
DROP POLICY IF EXISTS "Users can insert own trust score" ON public.seller_trust_scores;
DROP POLICY IF EXISTS "Users can update own trust score" ON public.seller_trust_scores;
DROP POLICY IF EXISTS "Users can delete own trust score" ON public.seller_trust_scores;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='seller_trust_scores' AND policyname='Users view own trust score') THEN
    CREATE POLICY "Users view own trust score" ON public.seller_trust_scores
      FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
  END IF;
END $$;

DROP POLICY IF EXISTS "Buyers update escrows" ON public.market_escrow;
DROP POLICY IF EXISTS "Sellers update escrows" ON public.market_escrow;

DROP POLICY IF EXISTS "Public client access via portal token" ON public.clients;
DROP POLICY IF EXISTS "Public client access for quotes" ON public.clients;
DROP POLICY IF EXISTS "Public quote access by token" ON public.quotes;
DROP POLICY IF EXISTS "Public quote approval by token" ON public.quotes;
DROP POLICY IF EXISTS "Public Portal access" ON public.work_orders;
DROP POLICY IF EXISTS "Public portal access" ON public.work_orders;
DROP POLICY IF EXISTS "Public portal access" ON public.invoices;
DROP POLICY IF EXISTS "Public portal access to invoices" ON public.invoices;
DROP POLICY IF EXISTS "Public portal access" ON public.vehicles;
DROP POLICY IF EXISTS "Portal access" ON public.vehicle_global_history;
DROP POLICY IF EXISTS "Public confirm via token" ON public.sale_confirmations;
DROP POLICY IF EXISTS "Public read partner invite by token" ON public.partner_invites;
DROP POLICY IF EXISTS "Public read invite by token" ON public.supplier_invites;
DROP POLICY IF EXISTS "Public shop access by slug" ON public.shops;

REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (id, name, slug, logo_url, language, currency, country_code, country, primary_color, latitude, longitude, status, timezone, is_carity_partner)
  ON public.shops TO anon;

REVOKE SELECT ON public.carity_seller_profiles FROM anon;
GRANT SELECT (id, user_id, name, account_type, verified, created_at, dealer_company_name, dealer_city, dealer_logo_url, dealer_description, dealer_slug)
  ON public.carity_seller_profiles TO anon;

REVOKE SELECT ON public.country_settings FROM anon;
GRANT SELECT (code, name, currency, currency_symbol, active, default_language, locale, flag_emoji, supported_languages, tax_label, timezones, launch_date)
  ON public.country_settings TO anon;

CREATE OR REPLACE FUNCTION public.get_quote_by_token(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _q record; _c record; _v record; _s record;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  SELECT * INTO _q FROM public.quotes WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT name, email, phone, company INTO _c FROM public.clients WHERE id = _q.client_id;
  SELECT make, model, plate, year, fuel, mileage INTO _v FROM public.vehicles WHERE id = _q.vehicle_id;
  SELECT name, email, phone, nif, address, logo_url, currency, language INTO _s FROM public.shops WHERE id = _q.shop_id;
  RETURN jsonb_build_object('quote', to_jsonb(_q), 'client', to_jsonb(_c), 'vehicle', to_jsonb(_v), 'shop', to_jsonb(_s));
END $$;

CREATE OR REPLACE FUNCTION public.respond_to_quote_by_token(
  _token text, _action text, _client_notes text DEFAULT NULL,
  _signature_data text DEFAULT NULL, _signature_hash text DEFAULT NULL, _signer_name text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _q record;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _action NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  SELECT * INTO _q FROM public.quotes WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _q.status IN ('approved','rejected','expired') THEN RAISE EXCEPTION 'already_processed'; END IF;
  IF _q.validity_date IS NOT NULL AND _q.validity_date < CURRENT_DATE THEN
    UPDATE public.quotes SET status = 'expired' WHERE id = _q.id;
    RAISE EXCEPTION 'expired';
  END IF;
  UPDATE public.quotes SET
    status = _action,
    client_notes = COALESCE(_client_notes, client_notes),
    signature_data = CASE WHEN _action='approved' THEN _signature_data ELSE signature_data END,
    signature_hash = CASE WHEN _action='approved' THEN _signature_hash ELSE signature_hash END,
    signer_name = CASE WHEN _action='approved' THEN _signer_name ELSE signer_name END,
    signed_at = CASE WHEN _action='approved' THEN now() ELSE signed_at END,
    updated_at = now()
  WHERE id = _q.id;
  RETURN jsonb_build_object('ok', true, 'id', _q.id, 'status', _action);
END $$;

CREATE OR REPLACE FUNCTION public.get_client_portal_data(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _c record; _s record; _wo jsonb; _q jsonb; _i jsonb; _v jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  SELECT id, name, email, phone, company, shop_id INTO _c
    FROM public.clients WHERE portal_token = _token AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT id, name, email, phone, logo_url, currency, language, slug INTO _s FROM public.shops WHERE id = _c.shop_id;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO _wo FROM (
    SELECT to_jsonb(w) || jsonb_build_object('vehicle', to_jsonb(v)) AS t
    FROM public.work_orders w LEFT JOIN public.vehicles v ON v.id = w.vehicle_id
    WHERE w.client_id = _c.id ORDER BY w.created_at DESC LIMIT 50
  ) sub;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO _q FROM (
    SELECT to_jsonb(q) || jsonb_build_object('vehicle', to_jsonb(v)) AS t
    FROM public.quotes q LEFT JOIN public.vehicles v ON v.id = q.vehicle_id
    WHERE q.client_id = _c.id ORDER BY q.created_at DESC LIMIT 50
  ) sub;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO _i FROM (
    SELECT to_jsonb(i) || jsonb_build_object('vehicle', to_jsonb(v)) AS t
    FROM public.invoices i LEFT JOIN public.vehicles v ON v.id = i.vehicle_id
    WHERE i.client_id = _c.id ORDER BY i.created_at DESC LIMIT 50
  ) sub;
  SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY v.created_at DESC), '[]'::jsonb) INTO _v
    FROM public.vehicles v WHERE v.client_id = _c.id AND v.deleted_at IS NULL;
  RETURN jsonb_build_object('client', to_jsonb(_c), 'shop', to_jsonb(_s),
    'work_orders', _wo, 'quotes', _q, 'invoices', _i, 'vehicles', _v);
END $$;

CREATE OR REPLACE FUNCTION public.get_public_shop_by_slug(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', id, 'name', name, 'slug', slug, 'logo_url', logo_url,
    'phone', phone, 'email', email, 'currency', currency, 'language', language,
    'primary_color', primary_color, 'address', address
  ) FROM public.shops WHERE slug = _slug LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_quote_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_quote_by_token(text,text,text,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_portal_data(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_shop_by_slug(text) TO anon, authenticated;
