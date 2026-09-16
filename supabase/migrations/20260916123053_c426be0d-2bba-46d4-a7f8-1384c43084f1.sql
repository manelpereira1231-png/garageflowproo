DROP POLICY IF EXISTS gsn_products_public_read ON public.gsn_products;
CREATE POLICY gsn_products_public_read ON public.gsn_products
FOR SELECT
USING (
  status = 'active'::gsn_product_status
  AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.gsn_suppliers s
     WHERE s.id = gsn_products.supplier_id
       AND s.approved = true AND s.active = true
       AND s.suspended = false AND s.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS gsn_suppliers_public_read ON public.gsn_suppliers;
CREATE POLICY gsn_suppliers_public_read ON public.gsn_suppliers
FOR SELECT
USING (approved = true AND active = true AND suspended = false AND deleted_at IS NULL);

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
       AND s.approved = true AND s.active = true AND s.suspended = false AND s.deleted_at IS NULL
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