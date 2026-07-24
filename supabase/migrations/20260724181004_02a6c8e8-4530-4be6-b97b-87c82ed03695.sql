
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ BEGIN CREATE TYPE public.gsn_order_state AS ENUM ('cart','pending','paid','confirmed','preparing','shipped','partial','delivered','cancelled','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.gsn_payment_state AS ENUM ('pending','authorized','captured','failed','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.gsn_notification_kind AS ENUM ('order_new','order_status','payment_new','tracking_new','low_stock','product_approved','supplier_approved','promo','review_new','complaint_new'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.gsn_suppliers
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS gsn_suppliers_slug_key ON public.gsn_suppliers(slug) WHERE slug IS NOT NULL;

UPDATE public.gsn_suppliers
   SET slug = lower(regexp_replace(coalesce(trade_name, company_name, id::text), '[^a-zA-Z0-9]+', '-', 'g'))
 WHERE slug IS NULL;

CREATE INDEX IF NOT EXISTS gsn_products_title_trgm ON public.gsn_products USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS gsn_products_sku_trgm   ON public.gsn_products USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS gsn_products_ean_trgm   ON public.gsn_products USING gin (ean gin_trgm_ops);
CREATE INDEX IF NOT EXISTS gsn_products_brand_trgm ON public.gsn_products USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS gsn_products_status_idx ON public.gsn_products (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS gsn_products_supplier_status_idx ON public.gsn_products (supplier_id, status);
CREATE INDEX IF NOT EXISTS gsn_orders_supplier_status_idx ON public.gsn_orders (supplier_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS gsn_orders_buyer_idx ON public.gsn_orders (buyer_shop_id, created_at DESC);

-- CARTS
CREATE TABLE IF NOT EXISTS public.gsn_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_carts TO authenticated;
GRANT ALL ON public.gsn_carts TO service_role;
ALTER TABLE public.gsn_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carts_own" ON public.gsn_carts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = shop_id) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = shop_id));

CREATE TABLE IF NOT EXISTS public.gsn_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.gsn_carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.gsn_products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  vat numeric(5,2) NOT NULL DEFAULT 23,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, product_id)
);
CREATE INDEX IF NOT EXISTS gsn_cart_items_cart_idx ON public.gsn_cart_items(cart_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_cart_items TO authenticated;
GRANT ALL ON public.gsn_cart_items TO service_role;
ALTER TABLE public.gsn_cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_items_own" ON public.gsn_cart_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gsn_carts c WHERE c.id = cart_id AND (EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = c.shop_id) OR has_role(auth.uid(),'super_admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.gsn_carts c WHERE c.id = cart_id AND EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = c.shop_id)));

-- ORDER EVENTS
CREATE TABLE IF NOT EXISTS public.gsn_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.gsn_orders(id) ON DELETE CASCADE,
  actor_user_id uuid,
  from_status text,
  to_status text NOT NULL,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gsn_order_events_order_idx ON public.gsn_order_events(order_id, created_at DESC);
GRANT SELECT, INSERT ON public.gsn_order_events TO authenticated;
GRANT ALL ON public.gsn_order_events TO service_role;
ALTER TABLE public.gsn_order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_events_readable" ON public.gsn_order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gsn_orders o WHERE o.id = order_id AND
    (EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = o.supplier_id AND s.owner_user_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = o.buyer_shop_id)
     OR has_role(auth.uid(),'super_admin'::app_role))));
CREATE POLICY "order_events_insert" ON public.gsn_order_events FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

-- FAVORITOS PRODUTOS
CREATE TABLE IF NOT EXISTS public.gsn_favorites_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.gsn_products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT, INSERT, DELETE ON public.gsn_favorites_products TO authenticated;
GRANT ALL ON public.gsn_favorites_products TO service_role;
ALTER TABLE public.gsn_favorites_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fav_products_own" ON public.gsn_favorites_products FOR ALL TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (user_id = auth.uid());

-- PAYMENT INTENTS
CREATE TABLE IF NOT EXISTS public.gsn_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.gsn_orders(id) ON DELETE SET NULL,
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  shop_id uuid,
  state public.gsn_payment_state NOT NULL DEFAULT 'pending',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.gsn_payment_intents TO authenticated;
GRANT ALL ON public.gsn_payment_intents TO service_role;
ALTER TABLE public.gsn_payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay_intents_readable" ON public.gsn_payment_intents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR (shop_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = shop_id))
    OR has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "pay_intents_admin_write" ON public.gsn_payment_intents FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));

-- PROMOTIONS
CREATE TABLE IF NOT EXISTS public.gsn_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed')),
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int,
  usage_count int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_promotions TO authenticated;
GRANT ALL ON public.gsn_promotions TO service_role;
ALTER TABLE public.gsn_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions_public_read" ON public.gsn_promotions FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "promotions_owner_manage" ON public.gsn_promotions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid()) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid()) OR has_role(auth.uid(),'super_admin'::app_role));

CREATE TABLE IF NOT EXISTS public.gsn_promotion_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.gsn_promotions(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.gsn_orders(id) ON DELETE SET NULL,
  shop_id uuid,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.gsn_promotion_redemptions TO authenticated;
GRANT ALL ON public.gsn_promotion_redemptions TO service_role;
ALTER TABLE public.gsn_promotion_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_red_readable" ON public.gsn_promotion_redemptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.gsn_promotions p JOIN public.gsn_suppliers s ON s.id = p.supplier_id WHERE p.id = promotion_id AND s.owner_user_id = auth.uid())
    OR (shop_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = shop_id)));

-- CARRIER SHIPMENTS
CREATE TABLE IF NOT EXISTS public.gsn_carrier_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.gsn_orders(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  carrier text NOT NULL,
  tracking_code text,
  tracking_url text,
  status text NOT NULL DEFAULT 'created',
  shipped_at timestamptz,
  delivered_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gsn_shipments_order_idx ON public.gsn_carrier_shipments(order_id);
GRANT SELECT, INSERT, UPDATE ON public.gsn_carrier_shipments TO authenticated;
GRANT ALL ON public.gsn_carrier_shipments TO service_role;
ALTER TABLE public.gsn_carrier_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipments_read" ON public.gsn_carrier_shipments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gsn_orders o WHERE o.id = order_id AND
    (EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = o.supplier_id AND s.owner_user_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = o.buyer_shop_id)
     OR has_role(auth.uid(),'super_admin'::app_role))));
CREATE POLICY "shipments_supplier_write" ON public.gsn_carrier_shipments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid()) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid()) OR has_role(auth.uid(),'super_admin'::app_role));

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.gsn_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.gsn_notification_kind NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gsn_notif_user_idx ON public.gsn_notifications(user_id, read, created_at DESC);
GRANT SELECT, UPDATE ON public.gsn_notifications TO authenticated;
GRANT ALL ON public.gsn_notifications TO service_role;
ALTER TABLE public.gsn_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gsn_notif_own" ON public.gsn_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "gsn_notif_own_update" ON public.gsn_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- COMPLAINTS
CREATE TABLE IF NOT EXISTS public.gsn_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.gsn_orders(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  buyer_user_id uuid,
  shop_id uuid,
  subject text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.gsn_complaints TO authenticated;
GRANT ALL ON public.gsn_complaints TO service_role;
ALTER TABLE public.gsn_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "complaints_read" ON public.gsn_complaints FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid()
    OR (shop_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = shop_id))
    OR EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "complaints_insert_buyer" ON public.gsn_complaints FOR INSERT TO authenticated
  WITH CHECK (buyer_user_id = auth.uid());
CREATE POLICY "complaints_admin_update" ON public.gsn_complaints FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid()))
  WITH CHECK (true);

-- ADMIN LOGS
CREATE TABLE IF NOT EXISTS public.gsn_admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gsn_admin_logs_created_idx ON public.gsn_admin_logs(created_at DESC);
GRANT SELECT, INSERT ON public.gsn_admin_logs TO authenticated;
GRANT ALL ON public.gsn_admin_logs TO service_role;
ALTER TABLE public.gsn_admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_logs_admin" ON public.gsn_admin_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));

-- ORDERS policies: expand for buyer
DROP POLICY IF EXISTS "gsn_orders_own" ON public.gsn_orders;
CREATE POLICY "gsn_orders_supplier_manage" ON public.gsn_orders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid()) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid()) OR has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "gsn_orders_buyer_read" ON public.gsn_orders FOR SELECT TO authenticated
  USING (buyer_shop_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = buyer_shop_id));

DROP POLICY IF EXISTS "gsn_order_items_own" ON public.gsn_order_items;
CREATE POLICY "gsn_order_items_read" ON public.gsn_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gsn_orders o WHERE o.id = order_id AND
    (EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = o.supplier_id AND s.owner_user_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = o.buyer_shop_id)
     OR has_role(auth.uid(),'super_admin'::app_role))));
CREATE POLICY "gsn_order_items_write" ON public.gsn_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gsn_orders o JOIN public.gsn_suppliers s ON s.id = o.supplier_id WHERE o.id = order_id AND s.owner_user_id = auth.uid()) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.gsn_orders o JOIN public.gsn_suppliers s ON s.id = o.supplier_id WHERE o.id = order_id AND s.owner_user_id = auth.uid()) OR has_role(auth.uid(),'super_admin'::app_role));

DROP POLICY IF EXISTS "gsn_products_public_read" ON public.gsn_products;
CREATE POLICY "gsn_products_public_read" ON public.gsn_products FOR SELECT TO authenticated
  USING (status = 'active' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "gsn_suppliers_public_read" ON public.gsn_suppliers;
CREATE POLICY "gsn_suppliers_public_read" ON public.gsn_suppliers FOR SELECT TO authenticated
  USING (approved = true AND deleted_at IS NULL AND suspended = false);

DO $$ BEGIN CREATE TRIGGER trg_gsn_carts_updated_at BEFORE UPDATE ON public.gsn_carts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_gsn_cart_items_updated_at BEFORE UPDATE ON public.gsn_cart_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_gsn_payment_intents_updated_at BEFORE UPDATE ON public.gsn_payment_intents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_gsn_promotions_updated_at BEFORE UPDATE ON public.gsn_promotions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_gsn_shipments_updated_at BEFORE UPDATE ON public.gsn_carrier_shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_gsn_complaints_updated_at BEFORE UPDATE ON public.gsn_complaints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RPCs
CREATE OR REPLACE FUNCTION public.gsn_search_products(
  _q text DEFAULT NULL, _brand text DEFAULT NULL, _category text DEFAULT NULL,
  _supplier_id uuid DEFAULT NULL, _min_price numeric DEFAULT NULL, _max_price numeric DEFAULT NULL,
  _in_stock boolean DEFAULT NULL, _limit int DEFAULT 24, _offset int DEFAULT 0
) RETURNS SETOF public.gsn_products
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM public.gsn_products p
  JOIN public.gsn_suppliers s ON s.id = p.supplier_id
  WHERE p.status = 'active' AND p.deleted_at IS NULL
    AND s.approved = true AND s.suspended = false AND s.deleted_at IS NULL
    AND (_q IS NULL OR _q = '' OR (
      p.title ILIKE '%'||_q||'%' OR
      coalesce(p.sku,'') ILIKE '%'||_q||'%' OR
      coalesce(p.ean,'') ILIKE '%'||_q||'%' OR
      coalesce(p.brand,'') ILIKE '%'||_q||'%' OR
      coalesce(p.manufacturer_reference,'') ILIKE '%'||_q||'%' OR
      coalesce(p.model,'') ILIKE '%'||_q||'%'))
    AND (_brand IS NULL OR p.brand = _brand)
    AND (_category IS NULL OR p.category = _category)
    AND (_supplier_id IS NULL OR p.supplier_id = _supplier_id)
    AND (_min_price IS NULL OR p.price >= _min_price)
    AND (_max_price IS NULL OR p.price <= _max_price)
    AND (_in_stock IS NULL OR (_in_stock = true AND p.stock > 0))
  ORDER BY p.updated_at DESC
  LIMIT LEAST(_limit, 100) OFFSET GREATEST(_offset, 0);
$$;
GRANT EXECUTE ON FUNCTION public.gsn_search_products(text,text,text,uuid,numeric,numeric,boolean,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.gsn_cart_ensure(_shop_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cart_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = _shop_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO _cart_id FROM public.gsn_carts WHERE shop_id = _shop_id AND user_id = auth.uid();
  IF _cart_id IS NULL THEN
    INSERT INTO public.gsn_carts (shop_id, user_id) VALUES (_shop_id, auth.uid()) RETURNING id INTO _cart_id;
  END IF;
  RETURN _cart_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.gsn_cart_ensure(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.gsn_cart_add(_shop_id uuid, _product_id uuid, _quantity int DEFAULT 1)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cart_id uuid; _sup uuid; _price numeric; _vat numeric;
BEGIN
  _cart_id := public.gsn_cart_ensure(_shop_id);
  SELECT supplier_id, COALESCE(discount_price, price), vat INTO _sup, _price, _vat
    FROM public.gsn_products WHERE id = _product_id AND status='active' AND deleted_at IS NULL;
  IF _sup IS NULL THEN RAISE EXCEPTION 'product_not_available'; END IF;
  INSERT INTO public.gsn_cart_items(cart_id, product_id, supplier_id, quantity, unit_price, vat)
  VALUES (_cart_id, _product_id, _sup, GREATEST(_quantity,1), _price, _vat)
  ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = public.gsn_cart_items.quantity + EXCLUDED.quantity, unit_price = EXCLUDED.unit_price;
  RETURN _cart_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.gsn_cart_add(uuid,uuid,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.gsn_cart_checkout(_shop_id uuid)
RETURNS SETOF uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cart_id uuid; _sup uuid; _order_id uuid; _sub numeric; _vat numeric; _tot numeric; _comm_rate numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = _shop_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id INTO _cart_id FROM public.gsn_carts WHERE shop_id = _shop_id AND user_id = auth.uid();
  IF _cart_id IS NULL THEN RAISE EXCEPTION 'empty_cart'; END IF;

  FOR _sup IN SELECT DISTINCT supplier_id FROM public.gsn_cart_items WHERE cart_id = _cart_id LOOP
    SELECT COALESCE(SUM(quantity*unit_price),0), COALESCE(SUM(quantity*unit_price*vat/100.0),0)
      INTO _sub, _vat
      FROM public.gsn_cart_items WHERE cart_id = _cart_id AND supplier_id = _sup;
    SELECT commission_percentage INTO _comm_rate FROM public.gsn_suppliers WHERE id = _sup;
    _tot := _sub + _vat;
    INSERT INTO public.gsn_orders(supplier_id, buyer_shop_id, buyer_user_id, status, subtotal, vat_total, total, commission_total)
    VALUES (_sup, _shop_id, auth.uid(), 'pending', _sub, _vat, _tot, _tot * COALESCE(_comm_rate,5)/100.0)
    RETURNING id INTO _order_id;

    INSERT INTO public.gsn_order_items(order_id, product_id, quantity, unit_price, vat_rate, subtotal, total)
    SELECT _order_id, product_id, quantity, unit_price, vat, quantity*unit_price, quantity*unit_price*(1+vat/100.0)
      FROM public.gsn_cart_items WHERE cart_id = _cart_id AND supplier_id = _sup;

    INSERT INTO public.gsn_order_events(order_id, actor_user_id, from_status, to_status, note)
    VALUES (_order_id, auth.uid(), NULL, 'pending', 'Encomenda criada via checkout');

    INSERT INTO public.gsn_notifications(user_id, kind, title, body, link)
    SELECT owner_user_id, 'order_new'::gsn_notification_kind, 'Nova encomenda', 'Recebeu uma nova encomenda #' || substr(_order_id::text,1,8), '/supplier/orders'
      FROM public.gsn_suppliers WHERE id = _sup AND owner_user_id IS NOT NULL;

    RETURN NEXT _order_id;
  END LOOP;

  DELETE FROM public.gsn_cart_items WHERE cart_id = _cart_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.gsn_cart_checkout(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.gsn_order_transition(_order_id uuid, _to text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _from text; _sup uuid; _buyer uuid;
BEGIN
  SELECT status, supplier_id, buyer_shop_id INTO _from, _sup, _buyer FROM public.gsn_orders WHERE id = _order_id;
  IF _from IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF NOT (has_role(auth.uid(),'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = _sup AND s.owner_user_id = auth.uid())
    OR (_buyer IS NOT NULL AND EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = _buyer) AND _to = 'cancelled' AND _from IN ('pending','paid'))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.gsn_orders SET status = _to, updated_at = now() WHERE id = _order_id;
  INSERT INTO public.gsn_order_events(order_id, actor_user_id, from_status, to_status, note)
  VALUES (_order_id, auth.uid(), _from, _to, _note);

  INSERT INTO public.gsn_notifications(user_id, kind, title, body, link)
  SELECT buyer_user_id, 'order_status'::gsn_notification_kind, 'Estado da encomenda', 'A sua encomenda passou a ' || _to, '/parts/orders/' || _order_id
    FROM public.gsn_orders WHERE id = _order_id AND buyer_user_id IS NOT NULL;
END; $$;
GRANT EXECUTE ON FUNCTION public.gsn_order_transition(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gsn_complaint_create(_order_id uuid, _subject text, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _sup uuid; _shop uuid;
BEGIN
  SELECT supplier_id, buyer_shop_id INTO _sup, _shop FROM public.gsn_orders WHERE id = _order_id;
  IF _sup IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF NOT (_shop IS NOT NULL AND EXISTS (SELECT 1 FROM public.get_user_shop_ids(auth.uid()) g WHERE g = _shop)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.gsn_complaints(order_id, supplier_id, shop_id, buyer_user_id, subject, body)
  VALUES (_order_id, _sup, _shop, auth.uid(), _subject, _body) RETURNING id INTO _id;
  RETURN _id;
END; $$;
GRANT EXECUTE ON FUNCTION public.gsn_complaint_create(uuid,text,text) TO authenticated;
