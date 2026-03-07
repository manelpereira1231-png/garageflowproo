
-- Invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  vehicle_id uuid REFERENCES public.vehicles(id),
  work_order_id uuid REFERENCES public.work_orders(id),
  quote_id uuid REFERENCES public.quotes(id),
  number text NOT NULL,
  type text NOT NULL DEFAULT 'invoice',
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric NOT NULL DEFAULT 0,
  vat_total numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Invoice items table
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 23,
  total numeric NOT NULL DEFAULT 0
);

-- Payments table
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'cash',
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS for invoices
CREATE POLICY "Shop members manage invoices" ON public.invoices
  FOR ALL USING (
    shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid())
  ) WITH CHECK (
    shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid())
  );

-- RLS for invoice_items (through invoice)
CREATE POLICY "Shop members manage invoice items" ON public.invoice_items
  FOR ALL USING (
    invoice_id IN (SELECT id FROM public.invoices WHERE shop_id IN (SELECT get_user_shop_ids(auth.uid())))
    OR is_super_admin(auth.uid())
  ) WITH CHECK (
    invoice_id IN (SELECT id FROM public.invoices WHERE shop_id IN (SELECT get_user_shop_ids(auth.uid())))
    OR is_super_admin(auth.uid())
  );

-- RLS for payments
CREATE POLICY "Shop members manage payments" ON public.payments
  FOR ALL USING (
    shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid())
  ) WITH CHECK (
    shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid())
  );

-- Function to generate invoice numbers: FAT-2026-0001
CREATE OR REPLACE FUNCTION public.next_invoice_number(_shop_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _year text;
  _max_num int;
BEGIN
  _year := extract(year from now())::text;
  
  SELECT COALESCE(MAX(
    CASE WHEN number ~ ('^FAT-' || _year || '-\d+$')
      THEN NULLIF(regexp_replace(number, '^.*-', ''), '')::int
      ELSE 0
    END
  ), 0) INTO _max_num
  FROM public.invoices
  WHERE shop_id = _shop_id;
  
  RETURN 'FAT-' || _year || '-' || lpad((_max_num + 1)::text, 4, '0');
END;
$$;

-- Add invoices to cascade_delete_shop
CREATE OR REPLACE FUNCTION public.cascade_delete_shop(_shop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM payments WHERE shop_id = _shop_id;
  DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE shop_id = _shop_id);
  DELETE FROM invoices WHERE shop_id = _shop_id;
  DELETE FROM email_logs WHERE shop_id = _shop_id;
  DELETE FROM work_orders WHERE shop_id = _shop_id;
  DELETE FROM quotes WHERE shop_id = _shop_id;
  DELETE FROM alerts WHERE shop_id = _shop_id;
  DELETE FROM chat_messages WHERE shop_id = _shop_id;
  DELETE FROM notifications WHERE shop_id = _shop_id;
  DELETE FROM vehicles WHERE shop_id = _shop_id;
  DELETE FROM clients WHERE shop_id = _shop_id;
  DELETE FROM subscriptions WHERE shop_id = _shop_id;
  DELETE FROM shop_users WHERE shop_id = _shop_id;
  DELETE FROM shops WHERE id = _shop_id;
END;
$$;
