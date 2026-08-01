UPDATE public.work_orders SET total = 0 WHERE total < 0;

ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_total_non_negative CHECK (total IS NULL OR total >= 0) NOT VALID;
ALTER TABLE public.work_orders VALIDATE CONSTRAINT work_orders_total_non_negative;

UPDATE public.plans
SET limits = limits || jsonb_build_object(
  'max_team_members', -1,
  'max_work_orders_month', -1,
  'max_services_catalog', -1,
  'max_products_stock', -1,
  'max_sms_month', -1,
  'max_emails_month', -1,
  'max_whatsapp_month', -1,
  'max_campaigns', -1,
  'max_automations', -1
)
WHERE slug = 'garage';