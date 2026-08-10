ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS version text;

CREATE OR REPLACE FUNCTION public.get_public_invoice(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF _token IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'id', i.id,
    'number', i.number,
    'status', i.status,
    'issue_date', i.created_at,
    'due_date', i.due_date,
    'subtotal', i.subtotal,
    'tax', COALESCE(i.vat_total, 0),
    'total', i.total,
    'notes', i.notes,
    'paid_online_at', i.paid_online_at,
    'provider_pdf_url', i.provider_pdf_url,
    'client_name', c.name,
    'shop', jsonb_build_object(
      'name', s.name,
      'phone', s.phone,
      'email', s.email,
      'address', s.address,
      'logo_url', s.logo_url,
      'currency', COALESCE(i.currency, s.currency),
      'country_code', s.country_code,
      'online_payments', true
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'description', ii.description,
        'quantity', ii.quantity,
        'unit_price', ii.unit_price,
        'vat_rate', ii.vat_rate
      ))
      FROM public.invoice_items ii WHERE ii.invoice_id = i.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.invoices i
  JOIN public.shops s ON s.id = i.shop_id
  LEFT JOIN public.clients c ON c.id = i.client_id
  WHERE i.public_token = _token;

  RETURN result;
END;
$function$;

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
  SELECT make, model, version, plate, year, fuel, mileage INTO _v FROM public.vehicles WHERE id = _q.vehicle_id;
  SELECT name, email, phone, nif, address, logo_url, currency, language, labor_rate, vat_rate, country_code
    INTO _s FROM public.shops WHERE id = _q.shop_id;
  RETURN jsonb_build_object('quote', to_jsonb(_q), 'client', to_jsonb(_c), 'vehicle', to_jsonb(_v), 'shop', to_jsonb(_s));
END $function$;