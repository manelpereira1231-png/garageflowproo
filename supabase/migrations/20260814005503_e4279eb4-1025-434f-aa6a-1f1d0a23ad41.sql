CREATE INDEX IF NOT EXISTS idx_work_orders_client_id ON public.work_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle_id ON public.work_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_shop_created ON public.work_orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON public.quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_vehicle_id ON public.quotes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_quotes_shop_created ON public.quotes(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vehicle_id ON public.invoices(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_invoices_work_order_id ON public.invoices(work_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON public.invoices(quote_id);

CREATE INDEX IF NOT EXISTS idx_warranties_shop_id ON public.warranties(shop_id);
CREATE INDEX IF NOT EXISTS idx_warranties_client_id ON public.warranties(client_id);
CREATE INDEX IF NOT EXISTS idx_warranties_vehicle_id ON public.warranties(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_warranties_work_order_id ON public.warranties(work_order_id);
CREATE INDEX IF NOT EXISTS idx_warranties_invoice_id ON public.warranties(invoice_id);

CREATE INDEX IF NOT EXISTS idx_service_reminders_client_id ON public.service_reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_service_reminders_work_order_id ON public.service_reminders(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_attachments_shop_id ON public.work_order_attachments(shop_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_shop_id ON public.service_catalog(shop_id);
CREATE INDEX IF NOT EXISTS idx_inspection_checklists_shop_id ON public.inspection_checklists(shop_id);
CREATE INDEX IF NOT EXISTS idx_inspection_checklists_work_order_id ON public.inspection_checklists(work_order_id);

CREATE INDEX IF NOT EXISTS idx_alerts_client_id ON public.alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_alerts_vehicle_id ON public.alerts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_vehicle_id ON public.appointments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_client_id ON public.chat_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_client_id ON public.loyalty_points(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_client_id ON public.loyalty_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_shop_id ON public.loyalty_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON public.payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_payouts_shop_id ON public.shop_payouts(shop_id);
CREATE INDEX IF NOT EXISTS idx_trial_records_shop_id ON public.trial_records(shop_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_shop_id ON public.push_subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_shop_id ON public.campaigns(shop_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_shop_id ON public.crm_leads(shop_id);

CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON public.event_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at ON public.funnel_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_visits_created_at ON public.landing_visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON public.api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_shop_created ON public.notifications(shop_id, created_at DESC);