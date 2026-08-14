
CREATE OR REPLACE FUNCTION public.adjust_part_stock(
  _shop_id uuid,
  _part_id uuid,
  _delta numeric,
  _type text,
  _reason text DEFAULT NULL,
  _work_order_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_qty numeric;
  v_new numeric;
BEGIN
  IF _shop_id IS NULL OR _part_id IS NULL OR _delta IS NULL OR _delta = 0 THEN
    RAISE EXCEPTION 'invalid_arguments';
  END IF;
  IF _type NOT IN ('in','out','adjust','inventory') THEN
    RAISE EXCEPTION 'invalid_movement_type';
  END IF;
  IF NOT public.has_capability(_shop_id, 'stock.manage') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Lock the row: serialises concurrent movements on the same part.
  SELECT p.stock_quantity INTO v_qty
  FROM public.parts p
  WHERE p.id = _part_id AND p.shop_id = _shop_id
  FOR UPDATE;

  IF v_qty IS NULL THEN
    RAISE EXCEPTION 'part_not_found';
  END IF;

  v_new := v_qty + _delta;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'negative_stock';
  END IF;

  UPDATE public.parts SET stock_quantity = v_new WHERE id = _part_id AND shop_id = _shop_id;

  INSERT INTO public.stock_movements (shop_id, part_id, type, quantity, reason, work_order_id)
  VALUES (_shop_id, _part_id, _type, abs(_delta), _reason, _work_order_id);

  RETURN v_new;
END;
$function$;

REVOKE ALL ON FUNCTION public.adjust_part_stock(uuid, uuid, numeric, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_part_stock(uuid, uuid, numeric, text, text, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Public can create appointments" ON public.appointments;
CREATE POLICY "Public can create appointments"
ON public.appointments
FOR INSERT
TO anon
WITH CHECK (
  status = 'pending'
  AND source = 'public'
  AND EXISTS (
    SELECT 1 FROM public.shops sh
    WHERE sh.id = appointments.shop_id
      AND trim(coalesce(sh.name, '')) <> ''
  )
);
