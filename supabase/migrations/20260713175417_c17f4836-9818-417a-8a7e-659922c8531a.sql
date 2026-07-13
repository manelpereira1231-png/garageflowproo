
-- Vistas "públicas" (sem colunas financeiras internas) — security_invoker herda RLS da base
CREATE OR REPLACE VIEW public.quotes_public
WITH (security_invoker=on) AS
SELECT id, shop_id, number, date, validity_date, client_id, vehicle_id,
       lines, subtotal, vat_total, total, status, notes, token, created_at,
       client_notes, signature_data, signature_hash, signed_at, signer_name, labor_hours
FROM public.quotes;

CREATE OR REPLACE VIEW public.work_orders_public
WITH (security_invoker=on) AS
SELECT id, shop_id, number, origin, quote_id, client_id, vehicle_id,
       entry_mileage, client_description, diagnosis, status, created_at
FROM public.work_orders;

CREATE OR REPLACE VIEW public.parts_public
WITH (security_invoker=on) AS
SELECT id, shop_id, name, reference, supplier, sale_price, vat_rate,
       stock_quantity, min_stock, active, created_at
FROM public.parts;

GRANT SELECT ON public.quotes_public TO authenticated;
GRANT SELECT ON public.work_orders_public TO authenticated;
GRANT SELECT ON public.parts_public TO authenticated;

-- Políticas RESTRITIVAS: só quem tem finance.view_costs lê dados financeiros
CREATE POLICY "payments_finance_only"
ON public.payments AS RESTRICTIVE
FOR SELECT TO authenticated
USING (public.has_capability(shop_id, 'finance.view_costs') OR public.is_super_admin(auth.uid()));

CREATE POLICY "shop_wallets_finance_only"
ON public.shop_wallets AS RESTRICTIVE
FOR SELECT TO authenticated
USING (public.has_capability(shop_id, 'finance.view_costs') OR public.is_super_admin(auth.uid()));

CREATE POLICY "shop_wallet_tx_finance_only"
ON public.shop_wallet_transactions AS RESTRICTIVE
FOR SELECT TO authenticated
USING (public.has_capability(shop_id, 'finance.view_costs') OR public.is_super_admin(auth.uid()));
