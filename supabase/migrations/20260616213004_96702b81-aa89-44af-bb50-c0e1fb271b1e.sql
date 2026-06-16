CREATE OR REPLACE FUNCTION public.get_client_portal_data(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _c record; _s record; _wo jsonb; _q jsonb; _i jsonb; _v jsonb; _tok uuid;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  BEGIN
    _tok := _token::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  SELECT id, name, email, phone, company, shop_id INTO _c
    FROM public.clients WHERE portal_token = _tok AND deleted_at IS NULL LIMIT 1;
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
END $function$;