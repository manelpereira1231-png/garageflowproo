REVOKE ALL ON FUNCTION public.tg_notify_quote_approval() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_notify_quote_approval() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_notify_quote_approval() TO service_role;