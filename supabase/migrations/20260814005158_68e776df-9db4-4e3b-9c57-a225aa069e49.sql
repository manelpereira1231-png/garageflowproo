-- Remove the membership-only policies that were OR-ed with (and therefore
-- neutralised) the capability guards already in place.
DROP POLICY IF EXISTS "Shop members view email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Shop members insert email logs" ON public.email_logs;

DROP POLICY IF EXISTS "Shop members manage service_reminders" ON public.service_reminders;

DROP POLICY IF EXISTS "Shop members manage vehicle_global_history" ON public.vehicle_global_history;

DROP POLICY IF EXISTS "Shop members manage notifications" ON public.notifications;

DROP POLICY IF EXISTS "document_series_shop_read" ON public.document_series;
DROP POLICY IF EXISTS "document_series_shop_insert" ON public.document_series;
DROP POLICY IF EXISTS "document_series_shop_update" ON public.document_series;
DROP POLICY IF EXISTS "document_series_shop_delete" ON public.document_series;