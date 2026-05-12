
CREATE OR REPLACE FUNCTION public.recalculate_workshop_trust(_shop_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE total int; flagged int; failed int; avg_risk numeric; approval numeric; pts int; lvl text;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE risk_score > 60),
         count(*) FILTER (WHERE audit_status = 'failed'),
         COALESCE(avg(risk_score), 0),
         CASE WHEN count(*)>0
           THEN round(count(*) FILTER (WHERE recommendation='recommended')::numeric / count(*)::numeric * 100, 1)
           ELSE 0 END
    INTO total, flagged, failed, avg_risk, approval
    FROM carity_inspection_reports
    WHERE shop_id = _shop_id AND completed_at IS NOT NULL;

  pts := 70 + LEAST(20, total) - (flagged * 4) - (failed * 10) - GREATEST(0, ((avg_risk - 20)::int) / 2);
  IF pts < 0 THEN pts := 0; END IF;
  IF pts > 100 THEN pts := 100; END IF;
  lvl := CASE WHEN pts >= 90 THEN 'platinum' WHEN pts >= 75 THEN 'gold' WHEN pts >= 50 THEN 'silver' ELSE 'bronze' END;

  INSERT INTO workshop_trust_scores (shop_id, score, level, total_inspections, flagged_inspections, audited_failed, avg_risk_score, approval_rate, last_recalculated_at)
  VALUES (_shop_id, pts, lvl, total, flagged, failed, round(avg_risk,1), approval, now())
  ON CONFLICT (shop_id) DO UPDATE SET
    score=EXCLUDED.score, level=EXCLUDED.level,
    total_inspections=EXCLUDED.total_inspections,
    flagged_inspections=EXCLUDED.flagged_inspections,
    audited_failed=EXCLUDED.audited_failed,
    avg_risk_score=EXCLUDED.avg_risk_score,
    approval_rate=EXCLUDED.approval_rate,
    last_recalculated_at=now();
END;
$$;
