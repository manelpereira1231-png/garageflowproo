
-- Fix appointments RLS: make public insert PERMISSIVE so anon users can book
DROP POLICY IF EXISTS "Public can create appointments" ON public.appointments;
CREATE POLICY "Public can create appointments"
  ON public.appointments FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Fix alerts: also need to allow anon insert for appointment alerts (via trigger approach)
-- But better: we'll handle alert creation server-side. For now, ensure status constraint is correct.
-- Drop and recreate alerts check constraints to be sure
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_status_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_status_check CHECK (
  status IN ('pending', 'sent', 'resolved', 'dismissed', 'snoozed')
);

ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_type_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_type_check CHECK (
  type IN ('revision', 'oil_change', 'inspection', 'warranty', 'quote_expired', 'inactive_client', 'maintenance', 'appointment', 'payment_failed', 'stock_low', 'marketing')
);

-- Create service_catalog table
CREATE TABLE IF NOT EXISTS public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  default_time integer NOT NULL DEFAULT 60,
  default_price numeric NOT NULL DEFAULT 0,
  internal_cost numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 23,
  recurrence_km integer,
  recurrence_months integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage service_catalog" ON public.service_catalog FOR ALL
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- Create parts/stock table
CREATE TABLE IF NOT EXISTS public.parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  reference text,
  supplier text,
  internal_cost numeric NOT NULL DEFAULT 0,
  sale_price numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 23,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage parts" ON public.parts FOR ALL
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- Stock movements table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'in' CHECK (type IN ('in', 'out', 'adjustment')),
  quantity integer NOT NULL,
  reason text,
  work_order_id uuid REFERENCES public.work_orders(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage stock_movements" ON public.stock_movements FOR ALL
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- Inspection checklists table
CREATE TABLE IF NOT EXISTS public.inspection_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  technician text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inspection_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage inspection_checklists" ON public.inspection_checklists FOR ALL
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- Work order attachments table
CREATE TABLE IF NOT EXISTS public.work_order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'image',
  file_size integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.work_order_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage work_order_attachments" ON public.work_order_attachments FOR ALL
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- Storage bucket for work order files
INSERT INTO storage.buckets (id, name, public) VALUES ('work-order-files', 'work-order-files', false) ON CONFLICT DO NOTHING;

-- Storage RLS for work-order-files bucket
CREATE POLICY "Shop members upload work order files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'work-order-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Shop members view work order files" ON storage.objects FOR SELECT
  USING (bucket_id = 'work-order-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Shop members delete work order files" ON storage.objects FOR DELETE
  USING (bucket_id = 'work-order-files' AND auth.uid() IS NOT NULL);

-- Update cascade_delete_shop to include new tables
CREATE OR REPLACE FUNCTION public.cascade_delete_shop(_shop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM work_order_attachments WHERE shop_id = _shop_id;
  DELETE FROM inspection_checklists WHERE shop_id = _shop_id;
  DELETE FROM stock_movements WHERE shop_id = _shop_id;
  DELETE FROM parts WHERE shop_id = _shop_id;
  DELETE FROM service_catalog WHERE shop_id = _shop_id;
  DELETE FROM service_reminders WHERE shop_id = _shop_id;
  DELETE FROM payments WHERE shop_id = _shop_id;
  DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE shop_id = _shop_id);
  DELETE FROM invoices WHERE shop_id = _shop_id;
  DELETE FROM email_logs WHERE shop_id = _shop_id;
  DELETE FROM work_orders WHERE shop_id = _shop_id;
  DELETE FROM quotes WHERE shop_id = _shop_id;
  DELETE FROM alerts WHERE shop_id = _shop_id;
  DELETE FROM appointments WHERE shop_id = _shop_id;
  DELETE FROM chat_messages WHERE shop_id = _shop_id;
  DELETE FROM notifications WHERE shop_id = _shop_id;
  DELETE FROM vehicles WHERE shop_id = _shop_id;
  DELETE FROM clients WHERE shop_id = _shop_id;
  DELETE FROM subscriptions WHERE shop_id = _shop_id;
  DELETE FROM shop_users WHERE shop_id = _shop_id;
  DELETE FROM shops WHERE id = _shop_id;
END;
$$;
