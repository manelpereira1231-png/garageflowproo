
-- Create labor timer table
CREATE TABLE public.work_order_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  technician_name text NOT NULL DEFAULT '',
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_order_times ENABLE ROW LEVEL SECURITY;

-- RLS policy: shop members manage their own timers
CREATE POLICY "Shop members manage work_order_times"
ON public.work_order_times FOR ALL
TO authenticated
USING (
  shop_id IN (SELECT public.get_user_shop_ids(auth.uid()))
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  shop_id IN (SELECT public.get_user_shop_ids(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- Index for fast lookups
CREATE INDEX idx_work_order_times_wo ON public.work_order_times(work_order_id);
CREATE INDEX idx_work_order_times_shop ON public.work_order_times(shop_id);
