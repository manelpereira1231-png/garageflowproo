
-- Vehicle global history for cross-shop tracking, km fraud detection, and vehicle passport
CREATE TABLE IF NOT EXISTS public.vehicle_global_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'service',  -- service, inspection, mileage_update, part_replacement, quote
  event_date timestamp with time zone NOT NULL DEFAULT now(),
  mileage integer,
  title text NOT NULL,
  description text,
  parts_replaced jsonb DEFAULT '[]'::jsonb,
  reference_id uuid,  -- work_order_id or quote_id etc
  reference_type text,  -- work_order, quote, inspection, invoice
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for quick vehicle lookups
CREATE INDEX idx_vehicle_global_history_vehicle ON public.vehicle_global_history(vehicle_id);
CREATE INDEX idx_vehicle_global_history_shop ON public.vehicle_global_history(shop_id);

-- RLS
ALTER TABLE public.vehicle_global_history ENABLE ROW LEVEL SECURITY;

-- Anyone in the vehicle's shop can view and insert
CREATE POLICY "Shop members manage vehicle_global_history"
  ON public.vehicle_global_history FOR ALL TO public
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- Public portal access (clients can view their vehicle history)
CREATE POLICY "Portal access vehicle_global_history"
  ON public.vehicle_global_history FOR SELECT TO public
  USING (vehicle_id IN (
    SELECT v.id FROM vehicles v
    JOIN clients c ON c.id = v.client_id
    WHERE c.portal_token IS NOT NULL
  ));
