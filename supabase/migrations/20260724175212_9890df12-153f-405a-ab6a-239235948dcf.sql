
-- ============================================================
-- GARAGEFLOW SUPPLIER NETWORK (GSN) — Fase 1
-- Prefixo gsn_ para evitar colisão com a tabela `suppliers` interna.
-- ============================================================

-- 1) Add 'supplier' to app_role enum
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'supplier'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'supplier';
  END IF;
END $$;

-- 2) system_features (feature flags globais)
CREATE TABLE IF NOT EXISTS public.system_features (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.system_features TO anon, authenticated;
GRANT ALL ON public.system_features TO service_role;
ALTER TABLE public.system_features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_features_read ON public.system_features;
CREATE POLICY system_features_read ON public.system_features FOR SELECT USING (true);
DROP POLICY IF EXISTS system_features_admin_write ON public.system_features;
CREATE POLICY system_features_admin_write ON public.system_features
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.system_features (key, enabled, description)
VALUES ('supplier_network_enabled', false, 'GarageFlow Supplier Network (B2B parts marketplace)')
ON CONFLICT (key) DO NOTHING;

-- 3) gsn_suppliers
CREATE TABLE IF NOT EXISTS public.gsn_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  trade_name text,
  vat_number text,
  email text,
  phone text,
  website text,
  country text DEFAULT 'PT',
  district text,
  city text,
  postal_code text,
  address text,
  logo_url text,
  banner_url text,
  description text,
  average_delivery_time text,
  minimum_order numeric(12,2) DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  approved boolean NOT NULL DEFAULT false,
  commission_percentage numeric(5,2) NOT NULL DEFAULT 5.00,
  stripe_account_id text,
  subscription_plan text,
  subscription_status text,
  rating_average numeric(3,2) NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  support_email text,
  support_phone text,
  pickup_available boolean NOT NULL DEFAULT false,
  delivery_available boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gsn_suppliers_owner_idx ON public.gsn_suppliers(owner_user_id);
CREATE INDEX IF NOT EXISTS gsn_suppliers_active_idx ON public.gsn_suppliers(active) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_suppliers TO authenticated;
GRANT ALL ON public.gsn_suppliers TO service_role;
ALTER TABLE public.gsn_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gsn_suppliers_own_select ON public.gsn_suppliers;
CREATE POLICY gsn_suppliers_own_select ON public.gsn_suppliers
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS gsn_suppliers_own_update ON public.gsn_suppliers;
CREATE POLICY gsn_suppliers_own_update ON public.gsn_suppliers
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS gsn_suppliers_admin_all ON public.gsn_suppliers;
CREATE POLICY gsn_suppliers_admin_all ON public.gsn_suppliers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- 4) gsn_categories
CREATE TABLE IF NOT EXISTS public.gsn_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.gsn_categories(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gsn_categories TO anon, authenticated;
GRANT ALL ON public.gsn_categories TO service_role;
ALTER TABLE public.gsn_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsn_categories_read ON public.gsn_categories;
CREATE POLICY gsn_categories_read ON public.gsn_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS gsn_categories_admin ON public.gsn_categories;
CREATE POLICY gsn_categories_admin ON public.gsn_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- 5) gsn_products
DO $$ BEGIN
  CREATE TYPE public.gsn_product_status AS ENUM ('draft','active','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.gsn_product_condition AS ENUM ('new','refurbished','used');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.gsn_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  sku text,
  manufacturer_reference text,
  ean text,
  brand text,
  model text,
  category text,
  subcategory text,
  title text NOT NULL,
  description text,
  technical_description text,
  compatibility jsonb NOT NULL DEFAULT '[]'::jsonb,
  weight numeric(10,3),
  length numeric(10,2),
  width numeric(10,2),
  height numeric(10,2),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reserved_stock integer NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  price numeric(12,2) NOT NULL DEFAULT 0,
  discount_price numeric(12,2),
  vat numeric(5,2) NOT NULL DEFAULT 23,
  currency text NOT NULL DEFAULT 'EUR',
  status public.gsn_product_status NOT NULL DEFAULT 'draft',
  condition public.gsn_product_condition NOT NULL DEFAULT 'new',
  image text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  datasheet text,
  manual_pdf text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsn_products_reserved_le_stock CHECK (reserved_stock <= stock)
);
CREATE INDEX IF NOT EXISTS gsn_products_supplier_idx ON public.gsn_products(supplier_id, status);
CREATE INDEX IF NOT EXISTS gsn_products_sku_idx ON public.gsn_products(sku);
CREATE INDEX IF NOT EXISTS gsn_products_ean_idx ON public.gsn_products(ean);
CREATE INDEX IF NOT EXISTS gsn_products_search_idx ON public.gsn_products
  USING gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_products TO authenticated;
GRANT ALL ON public.gsn_products TO service_role;
ALTER TABLE public.gsn_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsn_products_own ON public.gsn_products;
CREATE POLICY gsn_products_own ON public.gsn_products
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  );

-- 6) gsn_stock_movements
DO $$ BEGIN
  CREATE TYPE public.gsn_stock_move_type AS ENUM ('in','out','reserve','release','adjust','inventory');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.gsn_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.gsn_products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  type public.gsn_stock_move_type NOT NULL,
  quantity integer NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gsn_stock_moves_prod_idx ON public.gsn_stock_movements(product_id, created_at DESC);
GRANT SELECT, INSERT ON public.gsn_stock_movements TO authenticated;
GRANT ALL ON public.gsn_stock_movements TO service_role;
ALTER TABLE public.gsn_stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsn_stock_moves_own ON public.gsn_stock_movements;
CREATE POLICY gsn_stock_moves_own ON public.gsn_stock_movements
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  );

-- 7) STUBS (Fases 2-4)
CREATE TABLE IF NOT EXISTS public.gsn_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  buyer_shop_id uuid,
  buyer_user_id uuid,
  status text NOT NULL DEFAULT 'cart',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  vat_total numeric(12,2) NOT NULL DEFAULT 0,
  shipping_total numeric(12,2) NOT NULL DEFAULT 0,
  discount_total numeric(12,2) NOT NULL DEFAULT 0,
  commission_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  tracking_code text,
  carrier text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_orders TO authenticated;
GRANT ALL ON public.gsn_orders TO service_role;
ALTER TABLE public.gsn_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsn_orders_own ON public.gsn_orders;
CREATE POLICY gsn_orders_own ON public.gsn_orders
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  );

CREATE TABLE IF NOT EXISTS public.gsn_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.gsn_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.gsn_products(id) ON DELETE SET NULL,
  sku text,
  title text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  vat numeric(5,2) NOT NULL DEFAULT 23,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_order_items TO authenticated;
GRANT ALL ON public.gsn_order_items TO service_role;
ALTER TABLE public.gsn_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsn_order_items_own ON public.gsn_order_items;
CREATE POLICY gsn_order_items_own ON public.gsn_order_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gsn_orders o
      JOIN public.gsn_suppliers s ON s.id = o.supplier_id
      WHERE o.id = order_id AND (s.owner_user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gsn_orders o
      JOIN public.gsn_suppliers s ON s.id = o.supplier_id
      WHERE o.id = order_id AND (s.owner_user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
    )
  );

CREATE TABLE IF NOT EXISTS public.gsn_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.gsn_orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_payments TO authenticated;
GRANT ALL ON public.gsn_payments TO service_role;
ALTER TABLE public.gsn_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsn_payments_own ON public.gsn_payments;
CREATE POLICY gsn_payments_own ON public.gsn_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  );

CREATE TABLE IF NOT EXISTS public.gsn_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.gsn_orders(id) ON DELETE SET NULL,
  number text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  vat_total numeric(12,2) NOT NULL DEFAULT 0,
  shipping_total numeric(12,2) NOT NULL DEFAULT 0,
  discount_total numeric(12,2) NOT NULL DEFAULT 0,
  commission_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_invoices TO authenticated;
GRANT ALL ON public.gsn_invoices TO service_role;
ALTER TABLE public.gsn_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsn_invoices_own ON public.gsn_invoices;
CREATE POLICY gsn_invoices_own ON public.gsn_invoices
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  );

CREATE TABLE IF NOT EXISTS public.gsn_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.gsn_orders(id) ON DELETE SET NULL,
  buyer_user_id uuid,
  rating_overall integer CHECK (rating_overall BETWEEN 1 AND 5),
  rating_delivery integer CHECK (rating_delivery BETWEEN 1 AND 5),
  rating_price integer CHECK (rating_price BETWEEN 1 AND 5),
  rating_quality integer CHECK (rating_quality BETWEEN 1 AND 5),
  rating_service integer CHECK (rating_service BETWEEN 1 AND 5),
  comment text,
  reply text,
  moderated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_reviews TO authenticated;
GRANT ALL ON public.gsn_reviews TO service_role;
ALTER TABLE public.gsn_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsn_reviews_own ON public.gsn_reviews;
CREATE POLICY gsn_reviews_own ON public.gsn_reviews
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR buyer_user_id = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
  )
  WITH CHECK (
    buyer_user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin')
  );

CREATE TABLE IF NOT EXISTS public.gsn_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.gsn_favorites TO authenticated;
GRANT ALL ON public.gsn_favorites TO service_role;
ALTER TABLE public.gsn_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsn_favorites_own ON public.gsn_favorites;
CREATE POLICY gsn_favorites_own ON public.gsn_favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.gsn_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_coupons TO authenticated;
GRANT ALL ON public.gsn_coupons TO service_role;
ALTER TABLE public.gsn_coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsn_coupons_own ON public.gsn_coupons;
CREATE POLICY gsn_coupons_own ON public.gsn_coupons
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  );

CREATE TABLE IF NOT EXISTS public.gsn_carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  active boolean NOT NULL DEFAULT true,
  base_price numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsn_carriers TO authenticated;
GRANT ALL ON public.gsn_carriers TO service_role;
ALTER TABLE public.gsn_carriers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gsn_carriers_own ON public.gsn_carriers;
CREATE POLICY gsn_carriers_own ON public.gsn_carriers
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.gsn_suppliers s WHERE s.id = supplier_id AND s.owner_user_id = auth.uid())
    OR public.has_role(auth.uid(),'super_admin')
  );

-- 8) updated_at triggers
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'gsn_suppliers','gsn_categories','gsn_products','gsn_orders',
    'gsn_invoices','gsn_payments','gsn_reviews','gsn_coupons','gsn_carriers'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_'||t||'_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 'trg_'||t||'_updated_at', t);
  END LOOP;
END $$;

-- 9) helper
CREATE OR REPLACE FUNCTION public.get_my_supplier_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gsn_suppliers WHERE owner_user_id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_supplier_id() TO authenticated;
