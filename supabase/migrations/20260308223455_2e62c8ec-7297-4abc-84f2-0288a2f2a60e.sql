
-- 1. Fix public booking: make INSERT policy PERMISSIVE for anon users
DROP POLICY IF EXISTS "Public can create appointments" ON public.appointments;
CREATE POLICY "Public can create appointments"
  ON public.appointments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 2. Loyalty points table
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  points integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_redeemed integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'bronze',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, client_id)
);
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage loyalty_points"
  ON public.loyalty_points FOR ALL
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- 3. Loyalty transactions
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  points integer NOT NULL,
  type text NOT NULL DEFAULT 'earn',
  description text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage loyalty_transactions"
  ON public.loyalty_transactions FOR ALL
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- 4. Marketing campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'email',
  subject text,
  content text,
  target_segment text NOT NULL DEFAULT 'all',
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipients_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members manage campaigns"
  ON public.campaigns FOR ALL
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- 5. Update cascade_delete_shop
CREATE OR REPLACE FUNCTION public.cascade_delete_shop(_shop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  DELETE FROM loyalty_transactions WHERE shop_id = _shop_id;
  DELETE FROM loyalty_points WHERE shop_id = _shop_id;
  DELETE FROM campaigns WHERE shop_id = _shop_id;
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

-- 6. Add loyalty type to alerts
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_type_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_type_check CHECK (type IN (
  'revision', 'oil_change', 'inspection', 'warranty', 'quote_expired',
  'inactive_client', 'maintenance', 'appointment', 'payment_failed',
  'stock_low', 'marketing', 'loyalty'
));
