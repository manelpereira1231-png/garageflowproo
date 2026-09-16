-- 1) Public readable order number
ALTER TABLE public.gsn_orders ADD COLUMN IF NOT EXISTS order_number text;

CREATE SEQUENCE IF NOT EXISTS public.gsn_order_number_seq;

CREATE OR REPLACE FUNCTION public.gsn_set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'PED-' || to_char(now(), 'YYYY') || '-' ||
                        lpad(nextval('public.gsn_order_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gsn_orders_set_number ON public.gsn_orders;
CREATE TRIGGER gsn_orders_set_number
BEFORE INSERT ON public.gsn_orders
FOR EACH ROW EXECUTE FUNCTION public.gsn_set_order_number();

UPDATE public.gsn_orders
   SET order_number = 'PED-' || to_char(created_at, 'YYYY') || '-' ||
                      lpad(nextval('public.gsn_order_number_seq')::text, 6, '0')
 WHERE order_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gsn_orders_order_number_key ON public.gsn_orders(order_number);

-- 2) Fixed, transactional checkout (previous version referenced non-existent item columns)
CREATE OR REPLACE FUNCTION public.gsn_cart_checkout(_shop_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cart_id uuid; _sup uuid; _order_id uuid;
  _sub numeric; _vat numeric; _tot numeric; _comm_rate numeric;
  _item RECORD; _available integer; _title text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = _shop_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO _cart_id FROM public.gsn_carts WHERE shop_id = _shop_id AND user_id = auth.uid();
  IF _cart_id IS NULL THEN RAISE EXCEPTION 'empty_cart'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gsn_cart_items WHERE cart_id = _cart_id) THEN
    RAISE EXCEPTION 'empty_cart';
  END IF;

  -- Validate supplier availability and real stock before creating anything
  FOR _item IN
    SELECT ci.product_id, SUM(ci.quantity)::int AS quantity
      FROM public.gsn_cart_items ci
     WHERE ci.cart_id = _cart_id
     GROUP BY ci.product_id
  LOOP
    SELECT p.stock - COALESCE(p.reserved_stock, 0), p.title
      INTO _available, _title
      FROM public.gsn_products p
      JOIN public.gsn_suppliers s ON s.id = p.supplier_id
     WHERE p.id = _item.product_id
       AND p.deleted_at IS NULL
       AND p.status = 'active'
       AND s.approved = true AND s.suspended = false AND s.deleted_at IS NULL
     FOR UPDATE OF p;

    IF _available IS NULL THEN
      RAISE EXCEPTION 'product_unavailable';
    END IF;
    IF _available < _item.quantity THEN
      RAISE EXCEPTION 'insufficient_stock: % (disponível %, pedido %)', _title, _available, _item.quantity;
    END IF;
  END LOOP;

  FOR _sup IN SELECT DISTINCT supplier_id FROM public.gsn_cart_items WHERE cart_id = _cart_id LOOP
    SELECT COALESCE(SUM(quantity*unit_price),0),
           COALESCE(SUM(quantity*unit_price*vat/100.0),0)
      INTO _sub, _vat
      FROM public.gsn_cart_items WHERE cart_id = _cart_id AND supplier_id = _sup;
    SELECT commission_percentage INTO _comm_rate FROM public.gsn_suppliers WHERE id = _sup;
    _tot := _sub + _vat;

    INSERT INTO public.gsn_orders(supplier_id, buyer_shop_id, buyer_user_id, status,
                                  subtotal, vat_total, total, commission_total)
    VALUES (_sup, _shop_id, auth.uid(), 'pending',
            _sub, _vat, _tot, _tot * COALESCE(_comm_rate,5)/100.0)
    RETURNING id INTO _order_id;

    -- Snapshot price/vat/title/sku at order time
    INSERT INTO public.gsn_order_items(order_id, product_id, sku, title, quantity, unit_price, vat, line_total)
    SELECT _order_id, ci.product_id, p.sku, COALESCE(p.title, 'Produto'), ci.quantity, ci.unit_price, ci.vat,
           ci.quantity * ci.unit_price * (1 + ci.vat/100.0)
      FROM public.gsn_cart_items ci
      LEFT JOIN public.gsn_products p ON p.id = ci.product_id
     WHERE ci.cart_id = _cart_id AND ci.supplier_id = _sup;

    FOR _item IN
      SELECT product_id, quantity FROM public.gsn_cart_items
       WHERE cart_id = _cart_id AND supplier_id = _sup
    LOOP
      INSERT INTO public.gsn_stock_movements(product_id, supplier_id, type, quantity, reason, created_by)
      VALUES (_item.product_id, _sup, 'reserve', _item.quantity,
              'checkout order ' || _order_id::text, auth.uid());
    END LOOP;

    INSERT INTO public.gsn_order_events(order_id, actor_user_id, from_status, to_status, note)
    VALUES (_order_id, auth.uid(), NULL, 'pending', 'Encomenda criada via checkout');

    INSERT INTO public.gsn_notifications(user_id, kind, title, body, link)
    SELECT s.owner_user_id, 'order_new'::gsn_notification_kind,
           'Nova encomenda',
           'Recebeu a encomenda ' || COALESCE((SELECT order_number FROM public.gsn_orders WHERE id = _order_id), ''),
           '/supplier/orders'
      FROM public.gsn_suppliers s WHERE s.id = _sup AND s.owner_user_id IS NOT NULL;

    RETURN NEXT _order_id;
  END LOOP;

  DELETE FROM public.gsn_cart_items WHERE cart_id = _cart_id;
END;
$$;

-- 3) Only products of approved, active suppliers are visible to workshops
DROP POLICY IF EXISTS gsn_products_public_read ON public.gsn_products;
CREATE POLICY gsn_products_public_read ON public.gsn_products
FOR SELECT
USING (
  status = 'active'::gsn_product_status
  AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.gsn_suppliers s
     WHERE s.id = gsn_products.supplier_id
       AND s.approved = true AND s.suspended = false AND s.deleted_at IS NULL
  )
);

-- 4) Notify the buyer on every status change, using the readable order number
CREATE OR REPLACE FUNCTION public.gsn_order_transition(_order_id uuid, _to text, _note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _from text; _sup uuid; _buyer_shop uuid; _buyer_user uuid; _it RECORD; _kind gsn_notification_kind; _num text;
BEGIN
  SELECT status, supplier_id, buyer_shop_id, buyer_user_id, order_number
    INTO _from, _sup, _buyer_shop, _buyer_user, _num
    FROM public.gsn_orders WHERE id = _order_id FOR UPDATE;
  IF _from IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF _from = _to THEN RETURN; END IF;

  IF NOT (has_role(auth.uid(),'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = _sup AND s.owner_user_id = auth.uid())
    OR (_buyer_shop IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = _buyer_shop)
        AND _to = 'cancelled' AND _from IN ('pending','paid'))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.gsn_orders SET status = _to, updated_at = now() WHERE id = _order_id;

  INSERT INTO public.gsn_order_events(order_id, actor_user_id, from_status, to_status, note)
  VALUES (_order_id, auth.uid(), _from, _to, _note);

  IF _to = 'delivered' THEN
    FOR _it IN SELECT product_id, quantity FROM public.gsn_order_items WHERE order_id = _order_id AND product_id IS NOT NULL LOOP
      INSERT INTO public.gsn_stock_movements(product_id, supplier_id, type, quantity, reason, created_by)
      VALUES (_it.product_id, _sup, 'out', _it.quantity, 'delivered order ' || _order_id::text, auth.uid());
    END LOOP;
  ELSIF _to IN ('cancelled','refunded') AND _from NOT IN ('delivered') THEN
    FOR _it IN SELECT product_id, quantity FROM public.gsn_order_items WHERE order_id = _order_id AND product_id IS NOT NULL LOOP
      INSERT INTO public.gsn_stock_movements(product_id, supplier_id, type, quantity, reason, created_by)
      VALUES (_it.product_id, _sup, 'release', _it.quantity, _to || ' order ' || _order_id::text, auth.uid());
    END LOOP;
  END IF;

  IF _buyer_user IS NOT NULL THEN
    _kind := CASE WHEN _to = 'shipped' THEN 'tracking_new'::gsn_notification_kind
                  ELSE 'order_status'::gsn_notification_kind END;
    INSERT INTO public.gsn_notifications(user_id, kind, title, body, link)
    VALUES (_buyer_user, _kind,
            'Encomenda atualizada',
            'Encomenda ' || COALESCE(_num, substr(_order_id::text,1,8)) || ' passou a ' || _to,
            '/parts/orders/' || _order_id::text);
  END IF;
END;
$$;