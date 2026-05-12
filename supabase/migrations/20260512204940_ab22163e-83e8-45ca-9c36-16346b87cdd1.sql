
CREATE OR REPLACE FUNCTION public.trg_inspection_report_risk()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.calculate_inspection_risk(NEW.id);
  PERFORM public.recalculate_workshop_trust(NEW.shop_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_report_risk_ins ON public.carity_inspection_reports;
CREATE TRIGGER trg_inspection_report_risk_ins
  AFTER INSERT ON public.carity_inspection_reports
  FOR EACH ROW EXECUTE FUNCTION public.trg_inspection_report_risk();

DROP TRIGGER IF EXISTS trg_inspection_report_risk_upd ON public.carity_inspection_reports;
CREATE TRIGGER trg_inspection_report_risk_upd
  AFTER UPDATE OF completed_at, overall_score, recommendation, exterior_photos, engine_photos, brakes_photos, suspension_photos, tire_photos, inspection_lat, inspection_lng, started_at, audit_status
  ON public.carity_inspection_reports
  FOR EACH ROW EXECUTE FUNCTION public.trg_inspection_report_risk();
