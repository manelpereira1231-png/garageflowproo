-- 1) Campos extra nas transportadoras do fornecedor
ALTER TABLE public.gsn_carriers
  ADD COLUMN IF NOT EXISTS eta_days integer,
  ADD COLUMN IF NOT EXISTS free_above numeric(12,2);

-- 2) Compradores (oficinas) precisam de ler as transportadoras activas de fornecedores aprovados
DROP POLICY IF EXISTS gsn_carriers_public_read ON public.gsn_carriers;
CREATE POLICY gsn_carriers_public_read ON public.gsn_carriers
FOR SELECT TO authenticated
USING (
  active = true
  AND EXISTS (
    SELECT 1 FROM public.gsn_suppliers s
     WHERE s.id = gsn_carriers.supplier_id
       AND s.approved = true AND s.active = true
       AND s.suspended = false AND s.deleted_at IS NULL
  )
);

-- 3) Checkout com portes calculados no servidor
DROP FUNCTION IF EXISTS public.gsn_cart_checkout(uuid);
CREATE OR REPLACE FUNCTION public.gsn_cart_checkout(_shop_id uuid, _carriers jsonb DEFAULT '{}'::jsonb)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cart_id uuid; _sup uuid; _order_id uuid;
  _sub numeric; _vat numeric; _tot numeric; _comm_rate numeric;
  _item RECORD; _available integer; _title text;
  _carrier_id uuid; _carrier_name text; _ship numeric; _free numeric; _base numeric;
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

    IF _available IS NULL THEN RAISE EXCEPTION 'product_unavailable'; END IF;
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

    -- Transportadora escolhida pela oficina (preço vem SEMPRE da BD, nunca do cliente)
    _carrier_id := NULLIF(_carriers ->> _sup::text, '')::uuid;
    _carrier_name := NULL; _ship := 0;
    IF _carrier_id IS NOT NULL THEN
      SELECT name, base_price, free_above INTO _carrier_name, _base, _free
        FROM public.gsn_carriers
       WHERE id = _carrier_id AND supplier_id = _sup AND active = true;
      IF _carrier_name IS NULL THEN RAISE EXCEPTION 'carrier_invalid'; END IF;
      _ship := COALESCE(_base, 0);
      IF _free IS NOT NULL AND (_sub + _vat) >= _free THEN _ship := 0; END IF;
    ELSIF EXISTS (SELECT 1 FROM public.gsn_carriers WHERE supplier_id = _sup AND active = true) THEN
      RAISE EXCEPTION 'carrier_required';
    END IF;

    _tot := _sub + _vat + _ship;

    INSERT INTO public.gsn_orders(supplier_id, buyer_shop_id, buyer_user_id, status,
                                  subtotal, vat_total, shipping_total, total, commission_total,
                                  carrier, metadata)
    VALUES (_sup, _shop_id, auth.uid(), 'pending',
            _sub, _vat, _ship, _tot, (_sub + _vat) * COALESCE(_comm_rate,5)/100.0,
            _carrier_name,
            CASE WHEN _carrier_id IS NULL THEN '{}'::jsonb
                 ELSE jsonb_build_object('carrier_id', _carrier_id) END)
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
    VALUES (_order_id, auth.uid(), NULL, 'pending',
            'Encomenda criada via checkout' || COALESCE(' · ' || _carrier_name, ''));

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

-- 4) Expedição: transportadora + tracking + transição para 'shipped'
CREATE OR REPLACE FUNCTION public.gsn_order_ship(
  _order_id uuid,
  _carrier_id uuid DEFAULT NULL,
  _carrier_name text DEFAULT NULL,
  _tracking_code text DEFAULT NULL,
  _tracking_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _sup uuid; _status text; _name text;
BEGIN
  SELECT supplier_id, status INTO _sup, _status FROM public.gsn_orders WHERE id = _order_id FOR UPDATE;
  IF _sup IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF NOT (has_role(auth.uid(),'super_admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = _sup AND s.owner_user_id = auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _name := NULLIF(trim(COALESCE(_carrier_name, '')), '');
  IF _carrier_id IS NOT NULL THEN
    SELECT name INTO _name FROM public.gsn_carriers WHERE id = _carrier_id AND supplier_id = _sup;
    IF _name IS NULL THEN RAISE EXCEPTION 'carrier_invalid'; END IF;
  END IF;
  IF _name IS NULL THEN RAISE EXCEPTION 'carrier_required'; END IF;

  UPDATE public.gsn_orders
     SET carrier = _name,
         tracking_code = COALESCE(NULLIF(trim(COALESCE(_tracking_code,'')),''), tracking_code),
         updated_at = now()
   WHERE id = _order_id;

  IF EXISTS (SELECT 1 FROM public.gsn_carrier_shipments WHERE order_id = _order_id) THEN
    UPDATE public.gsn_carrier_shipments
       SET carrier = _name,
           tracking_code = COALESCE(NULLIF(trim(COALESCE(_tracking_code,'')),''), tracking_code),
           tracking_url = COALESCE(NULLIF(trim(COALESCE(_tracking_url,'')),''), tracking_url),
           status = 'shipped', shipped_at = COALESCE(shipped_at, now()), updated_at = now()
     WHERE order_id = _order_id;
  ELSE
    INSERT INTO public.gsn_carrier_shipments(order_id, supplier_id, carrier, tracking_code, tracking_url, status, shipped_at)
    VALUES (_order_id, _sup, _name,
            NULLIF(trim(COALESCE(_tracking_code,'')),''),
            NULLIF(trim(COALESCE(_tracking_url,'')),''),
            'shipped', now());
  END IF;

  IF _status <> 'shipped' THEN
    PERFORM public.gsn_order_transition(_order_id, 'shipped',
      'Expedido por ' || _name || COALESCE(' · ' || NULLIF(trim(COALESCE(_tracking_code,'')),''), ''));
  END IF;
END;
$$;

-- 5) Entrega marca o envio como entregue
CREATE OR REPLACE FUNCTION public.gsn_shipment_sync_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'delivered' AND COALESCE(OLD.status,'') <> 'delivered' THEN
    UPDATE public.gsn_carrier_shipments
       SET status = 'delivered', delivered_at = COALESCE(delivered_at, now()), updated_at = now()
     WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsn_shipment_delivered ON public.gsn_orders;
CREATE TRIGGER trg_gsn_shipment_delivered
AFTER UPDATE OF status ON public.gsn_orders
FOR EACH ROW EXECUTE FUNCTION public.gsn_shipment_sync_delivered();
