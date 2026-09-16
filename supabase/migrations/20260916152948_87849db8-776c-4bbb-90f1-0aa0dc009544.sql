CREATE OR REPLACE FUNCTION public.create_invoice_from_work_order(_work_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  wo public.work_orders%ROWTYPE;
  v_existing uuid;
  v_invoice_id uuid;
  v_number text;
  v_year text;
  v_max int;
  v_labor_rate numeric;
  v_vat_rate numeric;
  v_currency text;
  v_line jsonb;
  v_prefix text;
  v_desc text;
BEGIN
  SELECT * INTO wo FROM public.work_orders WHERE id = _work_order_id;
  IF wo.id IS NULL THEN
    RETURN jsonb_build_object('error', 'OS não encontrada');
  END IF;

  IF NOT (public.has_capability(wo.shop_id, 'invoices.create')
          OR public.has_capability(wo.shop_id, 'work_orders.complete')) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_existing FROM public.invoices WHERE work_order_id = wo.id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('invoice_id', v_existing, 'created', false);
  END IF;

  IF wo.client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'OS sem cliente associado');
  END IF;

  SELECT COALESCE(labor_rate, 30), COALESCE(vat_rate, 0), COALESCE(currency, 'EUR')
    INTO v_labor_rate, v_vat_rate, v_currency
  FROM public.shops WHERE id = wo.shop_id;

  PERFORM pg_advisory_xact_lock(hashtextextended('doc_number:FAT:' || wo.shop_id::text, 0));
  v_year := extract(year from now())::text;
  SELECT COALESCE(MAX(
    CASE WHEN number ~ ('^FAT-' || v_year || '-\d+$')
      THEN NULLIF(regexp_replace(number, '^.*-', ''), '')::int ELSE 0 END), 0)
    INTO v_max FROM public.invoices WHERE shop_id = wo.shop_id;
  v_number := 'FAT-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');

  INSERT INTO public.invoices (
    shop_id, client_id, vehicle_id, work_order_id, number, type, status,
    subtotal, vat_total, total, currency, notes
  ) VALUES (
    wo.shop_id, wo.client_id, wo.vehicle_id, wo.id, v_number, 'invoice', 'draft',
    COALESCE(wo.subtotal, 0), COALESCE(wo.vat_total, 0), COALESCE(wo.total, 0),
    COALESCE(v_currency, 'EUR'), wo.notes
  ) RETURNING id INTO v_invoice_id;

  IF jsonb_typeof(wo.lines) = 'array' THEN
    FOR v_line IN SELECT * FROM jsonb_array_elements(wo.lines) LOOP
      v_prefix := CASE v_line->>'type' WHEN 'part' THEN 'Peça' WHEN 'service' THEN 'Serviço' ELSE NULL END;
      v_desc := COALESCE(NULLIF(v_line->>'description',''), NULLIF(v_line->>'name',''));
      IF v_desc IS NOT NULL AND v_prefix IS NOT NULL THEN
        v_desc := v_prefix || ': ' || v_desc;
      ELSIF v_desc IS NULL THEN
        v_desc := COALESCE(v_prefix, 'Item');
      END IF;

      INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, vat_rate, total)
      VALUES (
        v_invoice_id,
        v_desc,
        COALESCE((v_line->>'quantity')::numeric, 1),
        COALESCE((v_line->>'unit_price')::numeric, 0),
        COALESCE((v_line->>'vat_rate')::numeric, 23),
        COALESCE((v_line->>'quantity')::numeric, 1) * COALESCE((v_line->>'unit_price')::numeric, 0)
          * (1 + COALESCE((v_line->>'vat_rate')::numeric, 23) / 100)
      );
    END LOOP;
  END IF;

  IF COALESCE(wo.labor_hours, 0) > 0 THEN
    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, vat_rate, total)
    VALUES (
      v_invoice_id,
      'Mão-de-obra adicional (' || wo.labor_hours || 'h)',
      wo.labor_hours, v_labor_rate, v_vat_rate,
      wo.labor_hours * v_labor_rate * (1 + v_vat_rate / 100)
    );
  END IF;

  RETURN jsonb_build_object('invoice_id', v_invoice_id, 'created', true, 'number', v_number);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_invoice_from_work_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_work_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_work_order(uuid) TO service_role;