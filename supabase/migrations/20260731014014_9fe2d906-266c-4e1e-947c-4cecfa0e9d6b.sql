CREATE OR REPLACE FUNCTION public.portal_respond_to_quote(_portal_token text, _quote_id uuid, _action text, _client_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    signed_at = CASE WHEN _action = 'approved' THEN now() ELSE signed_at END
  WHERE id = _q.id;

  RETURN jsonb_build_object('ok', true, 'id', _q.id, 'status', _action);
END $function$;

CREATE OR REPLACE FUNCTION public.portal_prepare_invoice_payment(_portal_token text, _invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  _pub := COALESCE(_inv.public_token, gen_random_uuid());

  UPDATE public.invoices
     SET public_token = _pub,
         payment_link_sent_at = COALESCE(payment_link_sent_at, now())
   WHERE id = _inv.id;

  RETURN jsonb_build_object('ok', true, 'token', _pub::text);
END $function$;