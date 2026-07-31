-- 1) Portal: decisão de orçamento pelo cliente
CREATE OR REPLACE FUNCTION public.portal_respond_to_quote(
  _portal_token text,
  _quote_id uuid,
  _action text,
  _client_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _client_id uuid; _q record; _tok uuid;
BEGIN
  IF _portal_token IS NULL OR length(_portal_token) < 8 THEN RAISE EXCEPTION 'invalid_token'; END IF;
  BEGIN _tok := _portal_token::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid_token'; END;
  IF _action NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'invalid_action'; END IF;

  SELECT id INTO _client_id FROM public.clients
   WHERE portal_token = _tok AND deleted_at IS NULL LIMIT 1;
  IF _client_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;

  SELECT * INTO _q FROM public.quotes WHERE id = _quote_id AND client_id = _client_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _q.status IN ('approved','rejected','expired','converted') THEN RAISE EXCEPTION 'already_processed'; END IF;
  IF _q.validity_date IS NOT NULL AND _q.validity_date < CURRENT_DATE THEN
    UPDATE public.quotes SET status = 'expired' WHERE id = _q.id;
    RAISE EXCEPTION 'expired';
  END IF;

  UPDATE public.quotes SET
    status = _action,
    client_notes = COALESCE(_client_notes, client_notes),
    signed_at = CASE WHEN _action = 'approved' THEN now() ELSE signed_at END,
    updated_at = now()
  WHERE id = _q.id;

  RETURN jsonb_build_object('ok', true, 'id', _q.id, 'status', _action);
END $$;

REVOKE ALL ON FUNCTION public.portal_respond_to_quote(text, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.portal_respond_to_quote(text, uuid, text, text) TO anon, authenticated;

-- 2) Portal: preparar pagamento online de uma fatura
CREATE OR REPLACE FUNCTION public.portal_prepare_invoice_payment(
  _portal_token text,
  _invoice_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _client_id uuid; _inv record; _tok uuid; _pub uuid;
BEGIN
  IF _portal_token IS NULL OR length(_portal_token) < 8 THEN RAISE EXCEPTION 'invalid_token'; END IF;
  BEGIN _tok := _portal_token::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid_token'; END;

  SELECT id INTO _client_id FROM public.clients
   WHERE portal_token = _tok AND deleted_at IS NULL LIMIT 1;
  IF _client_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;

  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id AND client_id = _client_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _inv.status NOT IN ('issued','partial') THEN RAISE EXCEPTION 'not_payable'; END IF;
  IF _inv.paid_online_at IS NOT NULL THEN RAISE EXCEPTION 'already_paid'; END IF;

  _pub := COALESCE(_inv.public_token::uuid, gen_random_uuid());

  UPDATE public.invoices
     SET public_token = _pub::text,
         payment_link_sent_at = COALESCE(payment_link_sent_at, now())
   WHERE id = _inv.id;

  RETURN jsonb_build_object('ok', true, 'token', _pub::text);
END $$;

REVOKE ALL ON FUNCTION public.portal_prepare_invoice_payment(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.portal_prepare_invoice_payment(text, uuid) TO anon, authenticated;

-- 3) Portal: incluir inspeções (checklists) do cliente
CREATE OR REPLACE FUNCTION public.get_client_portal_data(_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _c record; _s record; _wo jsonb; _q jsonb; _i jsonb; _v jsonb; _insp jsonb; _tok uuid;
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

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO _insp FROM (
    SELECT jsonb_build_object(
      'id', ic.id,
      'items', ic.items,
      'technician', ic.technician,
      'created_at', ic.created_at,
      'completed_at', ic.completed_at,
      'public_token', ic.public_token,
      'work_order_number', w.number,
      'vehicle', to_jsonb(v)
    ) AS t
    FROM public.inspection_checklists ic
    JOIN public.work_orders w ON w.id = ic.work_order_id
    LEFT JOIN public.vehicles v ON v.id = w.vehicle_id
    WHERE w.client_id = _c.id
    ORDER BY COALESCE(ic.completed_at, ic.created_at) DESC
    LIMIT 50
  ) sub;

  RETURN jsonb_build_object('client', to_jsonb(_c), 'shop', to_jsonb(_s),
    'work_orders', _wo, 'quotes', _q, 'invoices', _i, 'vehicles', _v,
    'inspections', _insp);
END $$;

GRANT EXECUTE ON FUNCTION public.get_client_portal_data(text) TO anon, authenticated;