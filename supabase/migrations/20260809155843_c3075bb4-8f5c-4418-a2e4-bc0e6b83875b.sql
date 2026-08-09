-- 1. Idempotência ao nível da peça (verificado: 0 duplicados existentes)
CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_wo_part_out_uidx
  ON public.stock_movements (work_order_id, part_id)
  WHERE type = 'out' AND work_order_id IS NOT NULL;

-- 2. Consumo transacional de peças de uma OS
CREATE OR REPLACE FUNCTION public.consume_work_order_parts(
  p_work_order_id uuid,
  p_lines jsonb DEFAULT NULL,
  p_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
  v_lines jsonb;
  v_rec record;
  v_part record;
  v_already integer;
  v_delta integer;
  v_consumed integer := 0;
  v_insufficient text[] := ARRAY[]::text[];
  v_new_stock integer;
BEGIN
  IF p_work_order_id IS NULL THEN
    RAISE EXCEPTION 'WORK_ORDER_REQUIRED';
  END IF;

  -- RLS aplica-se (SECURITY INVOKER): se a OS não for visível, não há linha.
  SELECT shop_id, COALESCE(p_lines, lines) INTO v_shop_id, v_lines
  FROM public.work_orders
  WHERE id = p_work_order_id;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'WORK_ORDER_NOT_FOUND: %', p_work_order_id;
  END IF;

  IF NOT public.has_capability(v_shop_id, 'stock.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN_STOCK_MANAGE';
  END IF;

  IF v_lines IS NULL OR jsonb_typeof(v_lines) <> 'array' THEN
    RETURN jsonb_build_object('consumed', 0, 'insufficient', '[]'::jsonb, 'skipped', true);
  END IF;

  -- Agregação das linhas de peça por part_id
  CREATE TEMP TABLE IF NOT EXISTS _cwop_lines (part_id uuid PRIMARY KEY, qty integer) ON COMMIT DROP;
  DELETE FROM _cwop_lines;

  INSERT INTO _cwop_lines (part_id, qty)
  SELECT (l->>'ref_id')::uuid, SUM(GREATEST(COALESCE((l->>'quantity')::numeric, 0), 0))::integer
  FROM jsonb_array_elements(v_lines) AS l
  WHERE l->>'type' = 'part'
    AND COALESCE(l->>'ref_id', '') <> ''
    AND COALESCE((l->>'quantity')::numeric, 0) > 0
  GROUP BY 1;

  IF NOT EXISTS (SELECT 1 FROM _cwop_lines) THEN
    RETURN jsonb_build_object('consumed', 0, 'insufficient', '[]'::jsonb, 'skipped', true);
  END IF;

  -- Bloqueio determinístico (ordem por part_id) para evitar deadlocks/race conditions
  PERFORM 1 FROM public.parts
   WHERE id IN (SELECT part_id FROM _cwop_lines) AND shop_id = v_shop_id
   ORDER BY id
   FOR UPDATE;

  FOR v_rec IN SELECT part_id, qty FROM _cwop_lines ORDER BY part_id LOOP
    SELECT id, name, stock_quantity INTO v_part
    FROM public.parts
    WHERE id = v_rec.part_id AND shop_id = v_shop_id;

    -- Peça inexistente ou de outra oficina => erro + rollback total
    IF v_part.id IS NULL THEN
      RAISE EXCEPTION 'PART_NOT_FOUND: %', v_rec.part_id;
    END IF;

    SELECT COALESCE(quantity, 0) INTO v_already
    FROM public.stock_movements
    WHERE work_order_id = p_work_order_id AND part_id = v_rec.part_id AND type = 'out';

    v_delta := v_rec.qty - COALESCE(v_already, 0);

    -- Igual ou reduzido: nada a fazer (sem devolução automática)
    IF v_delta <= 0 THEN
      CONTINUE;
    END IF;

    -- Decremento atómico (sem read-modify-write no cliente)
    UPDATE public.parts
       SET stock_quantity = stock_quantity - v_delta
     WHERE id = v_part.id AND shop_id = v_shop_id
    RETURNING stock_quantity INTO v_new_stock;

    IF v_new_stock < 0 THEN
      v_insufficient := v_insufficient || (v_part.name || ' (falta ' || abs(v_new_stock)::text || ')');
    END IF;

    IF v_already IS NULL THEN
      INSERT INTO public.stock_movements (shop_id, part_id, type, quantity, reason, work_order_id)
      VALUES (v_shop_id, v_part.id, 'out', v_delta,
              btrim('Consumo em serviço ' || COALESCE(p_reference, '')), p_work_order_id);
    ELSE
      UPDATE public.stock_movements
         SET quantity = v_rec.qty
       WHERE work_order_id = p_work_order_id AND part_id = v_rec.part_id AND type = 'out';
    END IF;

    v_consumed := v_consumed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'consumed', v_consumed,
    'insufficient', to_jsonb(v_insufficient),
    'skipped', v_consumed = 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_work_order_parts(uuid, jsonb, text) TO authenticated;