DROP FUNCTION IF EXISTS public.admin_list_risk_inspections(text, integer);

CREATE OR REPLACE FUNCTION public.admin_list_risk_inspections(_filter text DEFAULT 'all'::text, _limit integer DEFAULT 200)
 RETURNS TABLE(id uuid, shop_id uuid, shop_name text, listing_id uuid, overall_score numeric, recommendation text, risk_score integer, risk_level text, audit_status text, risk_flags jsonb, completed_at timestamp with time zone, technician_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT r.id, r.shop_id, s.name::text, r.listing_id,
         r.overall_score, r.recommendation,
         r.risk_score, r.risk_level, r.audit_status,
         r.risk_flags, r.completed_at, r.technician_name
    FROM public.carity_inspection_reports r
    LEFT JOIN public.shops s ON s.id = r.shop_id
   WHERE CASE _filter
           WHEN 'high' THEN r.risk_level='high'
           WHEN 'medium' THEN r.risk_level='medium'
           WHEN 'low' THEN r.risk_level='low'
           WHEN 'queued' THEN r.audit_status='queued'
           WHEN 'in_review' THEN r.audit_status='in_review'
           WHEN 'resolved' THEN r.audit_status='resolved'
           WHEN 'failed' THEN r.audit_status='failed'
           ELSE TRUE
         END
   ORDER BY r.risk_score DESC NULLS LAST, r.completed_at DESC NULLS LAST
   LIMIT _limit;
END;
$function$;