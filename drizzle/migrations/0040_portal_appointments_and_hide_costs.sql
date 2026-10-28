CREATE OR REPLACE FUNCTION public.get_client_portal_appointments(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _cid uuid; _tok uuid; _r jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN '[]'::jsonb; END IF;
  BEGIN _tok := _token::uuid; EXCEPTION WHEN others THEN RETURN '[]'::jsonb; END;
  SELECT id INTO _cid FROM public.clients WHERE portal_token = _tok AND deleted_at IS NULL LIMIT 1;
  IF _cid IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'date'), (t->>'time')), '[]'::jsonb) INTO _r FROM (
    SELECT jsonb_build_object('id', a.id, 'date', a.date, 'time', a.time, 'duration_minutes', a.duration_minutes,
      'status', a.status, 'service_type', a.service_type, 'auto_kind', a.auto_kind,
      'vehicle', CASE WHEN v.id IS NULL THEN NULL ELSE jsonb_build_object('make', v.make, 'model', v.model, 'plate', v.plate) END) AS t
    FROM public.appointments a LEFT JOIN public.vehicles v ON v.id = a.vehicle_id
    WHERE a.client_id = _cid AND a.date >= CURRENT_DATE AND COALESCE(a.status,'') NOT IN ('cancelled','completed','no_show')
    ORDER BY a.date, a.time LIMIT 20
  ) sub;
  RETURN _r;
END $$;
GRANT EXECUTE ON FUNCTION public.get_client_portal_appointments(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_client_portal_data(_token text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _c record; _s record; _wo jsonb; _q jsonb; _i jsonb; _v jsonb; _insp jsonb; _tok uuid;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  BEGIN _tok := _token::uuid; EXCEPTION WHEN others THEN RETURN NULL; END;
  SELECT id, name, email, phone, company, shop_id INTO _c
    FROM public.clients WHERE portal_token = _tok AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT id, name, email, phone, logo_url, currency, language, slug INTO _s FROM public.shops WHERE id = _c.shop_id;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO _wo FROM (
    SELECT (to_jsonb(w) - 'cost_total' - 'profit') || jsonb_build_object('vehicle', to_jsonb(v)) AS t
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

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO _insp FROM (
    SELECT jsonb_build_object('id', ic.id, 'items', ic.items, 'technician', ic.technician,
      'created_at', ic.created_at, 'completed_at', ic.completed_at, 'public_token', ic.public_token,
      'work_order_number', w.number, 'vehicle', to_jsonb(v)) AS t
    FROM public.inspection_checklists ic
    JOIN public.work_orders w ON w.id = ic.work_order_id
    LEFT JOIN public.vehicles v ON v.id = w.vehicle_id
    WHERE w.client_id = _c.id
    ORDER BY COALESCE(ic.completed_at, ic.created_at) DESC LIMIT 50
  ) sub;

  RETURN jsonb_build_object('client', to_jsonb(_c), 'shop', to_jsonb(_s),
    'work_orders', _wo, 'quotes', _q, 'invoices', _i, 'vehicles', _v, 'inspections', _insp);
END $function$;