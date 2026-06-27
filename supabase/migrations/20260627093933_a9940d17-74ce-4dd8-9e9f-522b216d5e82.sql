-- 1) Restore Data API access on shops & subscriptions (RLS still gates rows)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.shops TO service_role;
GRANT ALL ON public.subscriptions TO service_role;

-- 2) Fix public quote token lookup (column is uuid, RPC compared to text)
CREATE OR REPLACE FUNCTION public.get_quote_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _q record; _c record; _v record; _s record;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  SELECT * INTO _q FROM public.quotes WHERE token::text = _token LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT name, email, phone, company INTO _c FROM public.clients WHERE id = _q.client_id;
  SELECT make, model, plate, year, fuel, mileage INTO _v FROM public.vehicles WHERE id = _q.vehicle_id;
  SELECT name, email, phone, nif, address, logo_url, currency, language INTO _s FROM public.shops WHERE id = _q.shop_id;
  RETURN jsonb_build_object('quote', to_jsonb(_q), 'client', to_jsonb(_c), 'vehicle', to_jsonb(_v), 'shop', to_jsonb(_s));
END $function$;

-- Find respond_to_quote_by_token signature and patch the token comparison too
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='respond_to_quote_by_token'
  LIMIT 1;
  IF v_def IS NULL THEN RETURN; END IF;
  -- Replace bare `token = _token` (uuid=text mismatch) with `token::text = _token`
  v_def := regexp_replace(v_def, 'token\s*=\s*_token', 'token::text = _token', 'g');
  EXECUTE v_def;
END $$;