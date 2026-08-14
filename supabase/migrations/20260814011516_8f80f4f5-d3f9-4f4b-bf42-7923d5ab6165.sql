CREATE UNIQUE INDEX IF NOT EXISTS uniq_invoices_shop_number ON public.invoices (shop_id, number) WHERE number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_quotes_shop_number ON public.quotes (shop_id, number) WHERE number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_work_orders_shop_number ON public.work_orders (shop_id, number) WHERE number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.next_invoice_number(_shop_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _year text;
  _max_num int;
BEGIN
  IF NOT public.has_capability(_shop_id, 'invoices.create') THEN
    RAISE EXCEPTION 'permission denied for invoices.create' USING ERRCODE = '42501';
  END IF;

  -- Serializa a geração de números por oficina (evita números repetidos em pedidos simultâneos)
  PERFORM pg_advisory_xact_lock(hashtextextended('doc_number:FAT:' || _shop_id::text, 0));

  _year := extract(year from now())::text;

  SELECT COALESCE(MAX(
    CASE WHEN number ~ ('^FAT-' || _year || '-\d+$')
      THEN NULLIF(regexp_replace(number, '^.*-', ''), '')::int
      ELSE 0
    END
  ), 0) INTO _max_num
  FROM public.invoices
  WHERE shop_id = _shop_id;

  RETURN 'FAT-' || _year || '-' || lpad((_max_num + 1)::text, 4, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.next_number(_shop_id uuid, _prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _max_num int;
  _table text;
  _required_cap text;
BEGIN
  IF _prefix = 'ORC' THEN
    _table := 'quotes';
    _required_cap := 'quotes.create';
  ELSIF _prefix = 'SRV' THEN
    _table := 'work_orders';
    _required_cap := 'work_orders.create';
  ELSE
    RAISE EXCEPTION 'Unknown prefix: %', _prefix;
  END IF;

  IF NOT public.has_capability(_shop_id, _required_cap) THEN
    RAISE EXCEPTION 'permission denied for %', _required_cap USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('doc_number:' || _prefix || ':' || _shop_id::text, 0));

  EXECUTE format(
    'SELECT COALESCE(MAX(
      CASE WHEN number ~ (''^\s*'' || $1 || ''-\d+$'')
        THEN NULLIF(regexp_replace(number, ''^.*-'', ''''), '''')::int
        ELSE 0
      END
    ), 0) FROM %I WHERE shop_id = $2', _table
  ) INTO _max_num USING _prefix, _shop_id;

  RETURN _prefix || '-' || lpad((_max_num + 1)::text, 4, '0');
END;
$function$;

-- Stock GSN: impedir stock negativo em saídas
CREATE OR REPLACE FUNCTION public.gsn_apply_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _q integer := ABS(NEW.quantity); _cur integer;
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity = 0 THEN
    RAISE EXCEPTION 'gsn_stock_movements: quantity must be non-zero';
  END IF;

  SELECT stock INTO _cur FROM public.gsn_products WHERE id = NEW.product_id FOR UPDATE;
  IF _cur IS NULL THEN RAISE EXCEPTION 'gsn_stock_movements: product not found'; END IF;

  IF NEW.type = 'in' THEN
    UPDATE public.gsn_products SET stock = stock + _q WHERE id = NEW.product_id;
  ELSIF NEW.type = 'out' THEN
    IF _cur - _q < 0 THEN
      RAISE EXCEPTION 'gsn_stock_movements: insufficient stock (have %, need %)', _cur, _q;
    END IF;
    UPDATE public.gsn_products
       SET stock = stock - _q,
           reserved_stock = GREATEST(0, reserved_stock - _q)
     WHERE id = NEW.product_id;
  ELSIF NEW.type = 'reserve' THEN
    UPDATE public.gsn_products SET reserved_stock = reserved_stock + _q WHERE id = NEW.product_id;
  ELSIF NEW.type = 'release' THEN
    UPDATE public.gsn_products SET reserved_stock = GREATEST(0, reserved_stock - _q) WHERE id = NEW.product_id;
  ELSIF NEW.type = 'adjust' THEN
    IF _cur + NEW.quantity < 0 THEN
      RAISE EXCEPTION 'gsn_stock_movements: adjustment would make stock negative';
    END IF;
    UPDATE public.gsn_products SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.type = 'inventory' THEN
    UPDATE public.gsn_products SET stock = _q WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$function$;