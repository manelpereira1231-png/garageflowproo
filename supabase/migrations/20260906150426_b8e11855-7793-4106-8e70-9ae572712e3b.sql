REVOKE ALL ON FUNCTION public.recalc_platform_invoice_refunds(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_platform_refunds_sync() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_platform_refunds_touch() FROM PUBLIC, anon, authenticated;