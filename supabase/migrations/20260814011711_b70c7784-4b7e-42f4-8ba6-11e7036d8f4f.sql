CREATE OR REPLACE FUNCTION public.archive_old_events(_days integer DEFAULT 90)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_e int := 0; v_f int := 0; v_lv int := 0; v_te int := 0; v_at int := 0; v_al int := 0;
BEGIN
  WITH moved AS (
    DELETE FROM public.event_logs WHERE created_at < now() - make_interval(days => _days) RETURNING *
  ) INSERT INTO public.event_logs_archive SELECT * FROM moved;
  GET DIAGNOSTICS v_e = ROW_COUNT;

  WITH moved AS (
    DELETE FROM public.funnel_events WHERE created_at < now() - make_interval(days => _days) RETURNING *
  ) INSERT INTO public.funnel_events_archive SELECT * FROM moved;
  GET DIAGNOSTICS v_f = ROW_COUNT;

  DELETE FROM public.landing_visits WHERE created_at < now() - make_interval(days => _days);
  GET DIAGNOSTICS v_lv = ROW_COUNT;

  DELETE FROM public.email_tracking_events WHERE created_at < now() - make_interval(days => _days);
  GET DIAGNOSTICS v_te = ROW_COUNT;

  DELETE FROM public.action_trace WHERE created_at < now() - make_interval(days => _days);
  GET DIAGNOSTICS v_at = ROW_COUNT;

  DELETE FROM public.api_logs WHERE created_at < now() - make_interval(days => _days);
  GET DIAGNOSTICS v_al = ROW_COUNT;

  RETURN jsonb_build_object(
    'events_archived', v_e, 'funnel_archived', v_f,
    'landing_visits_purged', v_lv, 'email_tracking_purged', v_te,
    'action_trace_purged', v_at, 'api_logs_purged', v_al,
    'timestamp', now());
END $function$;

CREATE INDEX IF NOT EXISTS idx_landing_visits_created_at ON public.landing_visits (created_at);
CREATE INDEX IF NOT EXISTS idx_email_tracking_events_created_at ON public.email_tracking_events (created_at);
CREATE INDEX IF NOT EXISTS idx_action_trace_created_at ON public.action_trace (created_at);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON public.api_logs (created_at);