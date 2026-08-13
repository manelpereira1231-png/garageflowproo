
-- 1) Revogação de links públicos
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS token_revoked_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS public_token_revoked_at timestamptz;

-- 2) Throttle por token (usa a tabela rate_limits existente)
CREATE OR REPLACE FUNCTION public._public_token_throttle(_key text, _max int DEFAULT 240, _window_seconds int DEFAULT 600)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.rate_limits
   WHERE action_type = 'public_token' AND window_start < now() - make_interval(secs => _window_seconds);

  SELECT count FROM public.rate_limits
    INTO v_count
   WHERE action_type = 'public_token' AND identifier = _key
     AND window_start >= now() - make_interval(secs => _window_seconds)
   LIMIT 1;

  IF v_count IS NULL THEN
    INSERT INTO public.rate_limits (action_type, identifier, count, window_start)
    VALUES ('public_token', _key, 1, now());
    RETURN true;
  END IF;

  IF v_count >= _max THEN RETURN false; END IF;

  UPDATE public.rate_limits SET count = count + 1
   WHERE action_type = 'public_token' AND identifier = _key
     AND window_start >= now() - make_interval(secs => _window_seconds);
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN true; -- nunca bloquear um acesso legítimo por falha do contador
END;
$$;
REVOKE ALL ON FUNCTION public._public_token_throttle(text, int, int) FROM PUBLIC, anon, authenticated;

-- 3) get_public_invoice: TTL + revogação + estados inválidos
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
  WHERE i.public_token = _token
    AND i.public_token_revoked_at IS NULL
    AND i.status <> 'cancelled'
    AND i.status <> 'draft'
    AND i.created_at > now() - interval '365 days';

  RETURN result;
END;
$function$;

-- 4) get_quote_by_token: TTL + revogação
CREATE OR REPLACE FUNCTION public.get_quote_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _q record; _c record; _v record; _s record;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;

  SELECT * INTO _q FROM public.quotes
   WHERE token::text = _token
     AND token_revoked_at IS NULL
     AND status <> 'cancelled'
     AND created_at > now() - interval '365 days'
   LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT name, email, phone, company INTO _c FROM public.clients WHERE id = _q.client_id;
  SELECT make, model, version, plate, year, fuel, mileage INTO _v FROM public.vehicles WHERE id = _q.vehicle_id;
  SELECT name, email, phone, nif, address, logo_url, currency, language, labor_rate, vat_rate, country_code
    INTO _s FROM public.shops WHERE id = _q.shop_id;
  RETURN jsonb_build_object('quote', to_jsonb(_q), 'client', to_jsonb(_c), 'vehicle', to_jsonb(_v), 'shop', to_jsonb(_s));
END $function$;

-- 5) support_tickets: impedir criação em nome de terceiros
DROP POLICY IF EXISTS "Anyone can create support tickets" ON public.support_tickets;
CREATE POLICY "Anyone can create support tickets"
ON public.support_tickets FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 6) Contadores agregados por oficina (evita carregar todas as linhas)
CREATE OR REPLACE FUNCTION public.group_shop_counts(_shop_ids uuid[])
RETURNS TABLE (shop_id uuid, clients_count bigint, vehicles_count bigint)
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT s.id,
    (SELECT count(*) FROM public.clients c WHERE c.shop_id = s.id AND c.deleted_at IS NULL),
    (SELECT count(*) FROM public.vehicles v WHERE v.shop_id = s.id)
  FROM public.shops s
  WHERE s.id = ANY(_shop_ids);
$$;
GRANT EXECUTE ON FUNCTION public.group_shop_counts(uuid[]) TO authenticated;

-- 7) Índices para padrões reais em falta
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_created ON public.stock_movements (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicles_shop_created ON public.vehicles (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_shop_created ON public.email_logs (shop_id, created_at DESC);
