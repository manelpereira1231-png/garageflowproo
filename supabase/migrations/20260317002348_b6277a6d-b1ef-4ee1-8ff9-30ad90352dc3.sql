
-- Performance indexes for scale
CREATE INDEX IF NOT EXISTS idx_work_orders_shop_status ON public.work_orders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_shop_created ON public.work_orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_shop_status ON public.quotes(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_shop_created ON public.quotes(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_shop_status ON public.invoices(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_shop_due ON public.invoices(shop_id, due_date);
CREATE INDEX IF NOT EXISTS idx_clients_shop_name ON public.clients(shop_id, name);
CREATE INDEX IF NOT EXISTS idx_clients_shop_deleted ON public.clients(shop_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_shop_plate ON public.vehicles(shop_id, plate);
CREATE INDEX IF NOT EXISTS idx_vehicles_client ON public.vehicles(client_id);
CREATE INDEX IF NOT EXISTS idx_parts_shop_active ON public.parts(shop_id, active);
CREATE INDEX IF NOT EXISTS idx_alerts_shop_status ON public.alerts(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_shop_date ON public.appointments(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop ON public.stock_movements(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_shop_read ON public.notifications(shop_id, read);
CREATE INDEX IF NOT EXISTS idx_chat_messages_shop ON public.chat_messages(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_reminders_shop ON public.service_reminders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_shop ON public.automation_logs(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parts_orders_shop ON public.parts_orders(shop_id, status);
