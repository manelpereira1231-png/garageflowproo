
-- supplier_parts: catálogo de peças dos fornecedores
CREATE TABLE public.supplier_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  part_number text NOT NULL DEFAULT '',
  name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  stock_available integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read supplier_parts"
  ON public.supplier_parts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin manage supplier_parts"
  ON public.supplier_parts FOR ALL
  TO public
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- parts_order_items: itens individuais de cada pedido
CREATE TABLE public.parts_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.parts_orders(id) ON DELETE CASCADE,
  supplier_part_id uuid REFERENCES public.supplier_parts(id) ON DELETE SET NULL,
  part_name text NOT NULL,
  part_number text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.parts_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members manage parts_order_items"
  ON public.parts_order_items FOR ALL
  TO public
  USING (
    (order_id IN (SELECT id FROM public.parts_orders WHERE shop_id IN (SELECT get_user_shop_ids(auth.uid()))))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    (order_id IN (SELECT id FROM public.parts_orders WHERE shop_id IN (SELECT get_user_shop_ids(auth.uid()))))
    OR is_super_admin(auth.uid())
  );

-- Index for fast supplier_parts search
CREATE INDEX idx_supplier_parts_supplier ON public.supplier_parts(supplier_id);
CREATE INDEX idx_supplier_parts_search ON public.supplier_parts USING gin(to_tsvector('simple', name || ' ' || part_number || ' ' || brand));
CREATE INDEX idx_parts_order_items_order ON public.parts_order_items(order_id);
