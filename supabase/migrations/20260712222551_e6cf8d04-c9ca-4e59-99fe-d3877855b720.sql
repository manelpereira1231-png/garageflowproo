
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
  SELECT name, email, phone, nif, address, logo_url, currency, language, labor_rate, vat_rate
    INTO _s FROM public.shops WHERE id = _q.shop_id;
  RETURN jsonb_build_object('quote', to_jsonb(_q), 'client', to_jsonb(_c), 'vehicle', to_jsonb(_v), 'shop', to_jsonb(_s));
END $function$;
