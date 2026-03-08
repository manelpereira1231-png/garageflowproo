
-- Service reminders table
CREATE TABLE public.service_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  service_type text NOT NULL DEFAULT 'revision',
  next_service_date date,
  next_service_km integer,
  status text NOT NULL DEFAULT 'pending',
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members manage service_reminders"
ON public.service_reminders FOR ALL
USING (
  (shop_id IN (SELECT get_user_shop_ids(auth.uid())))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (shop_id IN (SELECT get_user_shop_ids(auth.uid())))
  OR is_super_admin(auth.uid())
);

-- Add to cascade delete
CREATE OR REPLACE FUNCTION public.cascade_delete_shop(_shop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
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
