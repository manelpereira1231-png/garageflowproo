
DROP VIEW IF EXISTS public.dealer_directory;
CREATE VIEW public.dealer_directory
WITH (security_invoker = true) AS
SELECT
  sp.user_id, sp.dealer_slug, sp.dealer_company_name, sp.dealer_logo_url,
  sp.dealer_city, sp.dealer_description, sp.country_code, sp.verified, sp.dealer_plan,
  COUNT(cl.id) FILTER (WHERE cl.status = 'published') AS active_listings,
  COUNT(cl.id) FILTER (WHERE cl.sold_at IS NOT NULL) AS total_sold
FROM public.carity_seller_profiles sp
LEFT JOIN public.carity_listings cl ON cl.seller_id = sp.user_id
WHERE sp.account_type = 'dealer'
  AND sp.dealer_slug IS NOT NULL
  AND sp.verified = true
GROUP BY sp.user_id, sp.dealer_slug, sp.dealer_company_name, sp.dealer_logo_url,
         sp.dealer_city, sp.dealer_description, sp.country_code, sp.verified, sp.dealer_plan;

GRANT SELECT ON public.dealer_directory TO anon, authenticated;
