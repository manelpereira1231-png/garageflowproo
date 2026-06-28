CREATE OR REPLACE FUNCTION public.respond_to_quote_by_token(
  _token text,
  _action text,
  _client_notes text DEFAULT NULL::text,
  _signature_data text DEFAULT NULL::text,
  _signature_hash text DEFAULT NULL::text,
  _signer_name text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _q record;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _action NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  SELECT * INTO _q FROM public.quotes WHERE token::text = _token LIMIT 1;
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
    signed_at = CASE WHEN _action='approved' THEN now() ELSE signed_at END
  WHERE id = _q.id;
  RETURN jsonb_build_object('ok', true, 'id', _q.id, 'status', _action);
END
$function$;