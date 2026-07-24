
-- ============================================================
-- Fase B: Supplier Network — critical DB fixes
-- ============================================================

-- 1) Public SELECT of moderated reviews
DROP POLICY IF EXISTS gsn_reviews_public_read ON public.gsn_reviews;
CREATE POLICY gsn_reviews_public_read
  ON public.gsn_reviews
  FOR SELECT
  TO anon, authenticated
  USING (moderated = true);

GRANT SELECT ON public.gsn_reviews TO anon;

-- 2) Supplier can reply to reviews about them (UPDATE only reply column enforced via trigger)
DROP POLICY IF EXISTS gsn_reviews_supplier_reply ON public.gsn_reviews;
CREATE POLICY gsn_reviews_supplier_reply
  ON public.gsn_reviews
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gsn_suppliers s
                 WHERE s.id = gsn_reviews.supplier_id
                   AND s.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.gsn_suppliers s
                      WHERE s.id = gsn_reviews.supplier_id
                        AND s.owner_user_id = auth.uid()));

-- Guard: supplier can only touch the reply field
CREATE OR REPLACE FUNCTION public.gsn_reviews_guard_supplier_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF OLD.buyer_user_id IS NOT DISTINCT FROM auth.uid() THEN
    RETURN NEW; -- buyer editing their own review
  END IF;
  IF EXISTS (SELECT 1 FROM public.gsn_suppliers s
             WHERE s.id = OLD.supplier_id AND s.owner_user_id = auth.uid()) THEN
    -- Supplier: only "reply" and "updated_at" may change
    IF NEW.rating_overall  IS DISTINCT FROM OLD.rating_overall
    OR NEW.rating_delivery IS DISTINCT FROM OLD.rating_delivery
    OR NEW.rating_price    IS DISTINCT FROM OLD.rating_price
    OR NEW.rating_quality  IS DISTINCT FROM OLD.rating_quality
    OR NEW.rating_service  IS DISTINCT FROM OLD.rating_service
    OR NEW.comment         IS DISTINCT FROM OLD.comment
    OR NEW.moderated       IS DISTINCT FROM OLD.moderated
    OR NEW.buyer_user_id   IS DISTINCT FROM OLD.buyer_user_id
    OR NEW.supplier_id     IS DISTINCT FROM OLD.supplier_id
    OR NEW.order_id        IS DISTINCT FROM OLD.order_id THEN
      RAISE EXCEPTION 'gsn_reviews: supplier may only edit the reply field';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsn_reviews_guard_supplier ON public.gsn_reviews;
CREATE TRIGGER trg_gsn_reviews_guard_supplier
  BEFORE UPDATE ON public.gsn_reviews
  FOR EACH ROW EXECUTE FUNCTION public.gsn_reviews_guard_supplier_update();

-- ============================================================
-- 3) Auto-apply stock movements to gsn_products
-- ============================================================
CREATE OR REPLACE FUNCTION public.gsn_apply_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _q integer := ABS(NEW.quantity);
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity = 0 THEN
    RAISE EXCEPTION 'gsn_stock_movements: quantity must be non-zero';
  END IF;

  IF NEW.type = 'in' THEN
    UPDATE public.gsn_products SET stock = stock + _q WHERE id = NEW.product_id;
  ELSIF NEW.type = 'out' THEN
    -- Prefer consuming from reserved_stock first if any
    UPDATE public.gsn_products
       SET stock = stock - _q,
           reserved_stock = GREATEST(0, reserved_stock - _q)
     WHERE id = NEW.product_id;
  ELSIF NEW.type = 'reserve' THEN
    UPDATE public.gsn_products SET reserved_stock = reserved_stock + _q WHERE id = NEW.product_id;
  ELSIF NEW.type = 'release' THEN
    UPDATE public.gsn_products
       SET reserved_stock = GREATEST(0, reserved_stock - _q)
     WHERE id = NEW.product_id;
  ELSIF NEW.type = 'adjust' THEN
    -- signed: quantity may be negative to decrement
    UPDATE public.gsn_products SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.type = 'inventory' THEN
    -- absolute set
    UPDATE public.gsn_products SET stock = _q WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsn_apply_stock_movement ON public.gsn_stock_movements;
CREATE TRIGGER trg_gsn_apply_stock_movement
  AFTER INSERT ON public.gsn_stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.gsn_apply_stock_movement();

-- ============================================================
-- 4) Reserve stock on checkout (recreate gsn_cart_checkout)
-- ============================================================
CREATE OR REPLACE FUNCTION public.gsn_cart_checkout(_shop_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cart_id uuid; _sup uuid; _order_id uuid;
  _sub numeric; _vat numeric; _tot numeric; _comm_rate numeric;
  _item RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = _shop_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT id INTO _cart_id FROM public.gsn_carts WHERE shop_id = _shop_id AND user_id = auth.uid();
  IF _cart_id IS NULL THEN RAISE EXCEPTION 'empty_cart'; END IF;

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

    INSERT INTO public.gsn_order_items(order_id, product_id, quantity, unit_price, vat_rate, subtotal, total)
    SELECT _order_id, product_id, quantity, unit_price, vat,
           quantity*unit_price, quantity*unit_price*(1+vat/100.0)
      FROM public.gsn_cart_items WHERE cart_id = _cart_id AND supplier_id = _sup;

    -- Reserve stock per item (CHECK constraint reserved_stock <= stock will block over-reservation)
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
    SELECT owner_user_id, 'order_new'::gsn_notification_kind,
           'Nova encomenda',
           'Recebeu uma nova encomenda #' || substr(_order_id::text,1,8),
           '/supplier/orders'
      FROM public.gsn_suppliers WHERE id = _sup AND owner_user_id IS NOT NULL;

    RETURN NEXT _order_id;
  END LOOP;

  DELETE FROM public.gsn_cart_items WHERE cart_id = _cart_id;
END;
$$;

-- ============================================================
-- 5) Transition side-effects: stock + buyer notifications
-- ============================================================
CREATE OR REPLACE FUNCTION public.gsn_order_transition(_order_id uuid, _to text, _note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _from text; _sup uuid; _buyer_shop uuid; _buyer_user uuid; _it RECORD; _kind gsn_notification_kind;
BEGIN
  SELECT status, supplier_id, buyer_shop_id, buyer_user_id
    INTO _from, _sup, _buyer_shop, _buyer_user
    FROM public.gsn_orders WHERE id = _order_id;
  IF _from IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;

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

  -- Stock side effects
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

  -- Buyer notification
  IF _buyer_user IS NOT NULL AND _to IN ('shipped','delivered','cancelled','refunded','partial') THEN
    _kind := CASE WHEN _to = 'shipped' THEN 'tracking_new'::gsn_notification_kind
                  ELSE 'order_status'::gsn_notification_kind END;
    INSERT INTO public.gsn_notifications(user_id, kind, title, body, link)
    VALUES (_buyer_user, _kind,
            'Encomenda ' || _to,
            'Encomenda #' || substr(_order_id::text,1,8) || ' atualizada para ' || _to,
            '/parts/orders/' || _order_id::text);
  END IF;
END;
$$;
