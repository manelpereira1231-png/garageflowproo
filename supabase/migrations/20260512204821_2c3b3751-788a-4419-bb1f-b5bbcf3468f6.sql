
CREATE OR REPLACE FUNCTION public.calculate_inspection_risk(_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  flags jsonb := '[]'::jsonb;
  score int := 0;
  lvl text;
  duration int;
  shop_total int;
  shop_perfect int;
  shop_approval numeric;
  consecutive_high int;
BEGIN
  SELECT * INTO r FROM carity_inspection_reports WHERE id = _report_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF r.started_at IS NOT NULL AND r.completed_at IS NOT NULL THEN
    duration := GREATEST(0, EXTRACT(EPOCH FROM (r.completed_at - r.started_at))::int);
  ELSE
    duration := r.inspection_duration_seconds;
  END IF;

  IF jsonb_array_length(COALESCE(r.exterior_photos,'[]'::jsonb)) = 0 THEN
    flags := flags || jsonb_build_array(jsonb_build_object('code','missing_exterior_photos','severity','high','msg','Fotos exteriores em falta'));
    score := score + 25;
  END IF;
  IF jsonb_array_length(COALESCE(r.engine_photos,'[]'::jsonb)) = 0 THEN
    flags := flags || jsonb_build_array(jsonb_build_object('code','missing_engine_photos','severity','medium','msg','Fotos de motor em falta'));
    score := score + 15;
  END IF;
  IF jsonb_array_length(COALESCE(r.brakes_photos,'[]'::jsonb)) = 0 THEN
    flags := flags || jsonb_build_array(jsonb_build_object('code','missing_brakes_photos','severity','medium','msg','Fotos de travões em falta'));
    score := score + 10;
  END IF;

  IF r.inspection_lat IS NULL OR r.inspection_lng IS NULL THEN
    flags := flags || jsonb_build_array(jsonb_build_object('code','missing_gps','severity','high','msg','GPS em falta'));
    score := score + 20;
  ELSIF r.inspection_lat = 0 AND r.inspection_lng = 0 THEN
    flags := flags || jsonb_build_array(jsonb_build_object('code','invalid_gps','severity','high','msg','GPS inválido'));
    score := score + 25;
  END IF;

  IF duration IS NOT NULL AND duration > 0 AND duration < 360 THEN
    flags := flags || jsonb_build_array(jsonb_build_object('code','too_fast','severity','high','msg', format('Inspeção demasiado rápida (%ss)', duration)));
    score := score + 25;
  END IF;

  IF r.overall_score >= 90 AND (
    r.engine_status IN ('warning','critical') OR r.brakes_status IN ('warning','critical') OR
    r.suspension_status IN ('warning','critical') OR r.transmission_status IN ('warning','critical') OR
    r.steering_status = 'critical'
  ) THEN
    flags := flags || jsonb_build_array(jsonb_build_object('code','score_checklist_mismatch','severity','medium','msg','Score elevado mas componentes com problemas'));
    score := score + 20;
  END IF;

  IF r.overall_score < 50 AND r.engine_status='ok' AND r.brakes_status='ok' AND
     r.suspension_status='ok' AND r.transmission_status='ok' AND r.steering_status='ok' AND r.tires_status='ok' THEN
    flags := flags || jsonb_build_array(jsonb_build_object('code','score_checklist_mismatch','severity','medium','msg','Score baixo mas tudo OK no checklist'));
    score := score + 15;
  END IF;

  SELECT count(*) INTO shop_total FROM carity_inspection_reports WHERE shop_id = r.shop_id AND completed_at IS NOT NULL;
  IF shop_total >= 5 THEN
    SELECT count(*) INTO shop_perfect FROM carity_inspection_reports WHERE shop_id = r.shop_id AND overall_score >= 95 AND completed_at IS NOT NULL;
    IF shop_perfect::numeric / shop_total::numeric > 0.7 THEN
      flags := flags || jsonb_build_array(jsonb_build_object('code','workshop_perfect_streak','severity','high','msg', format('%s de %s inspeções com score>=95', shop_perfect, shop_total)));
      score := score + 15;
    END IF;
    SELECT round(count(*) FILTER (WHERE recommendation='recommended')::numeric / count(*)::numeric * 100, 0)
      INTO shop_approval FROM carity_inspection_reports WHERE shop_id = r.shop_id AND completed_at IS NOT NULL;
    IF shop_approval >= 95 THEN
      flags := flags || jsonb_build_array(jsonb_build_object('code','workshop_high_approval','severity','medium','msg', format('Taxa de aprovação: %s%%', shop_approval)));
      score := score + 10;
    END IF;
  END IF;

  IF r.submitted_by_user_id IS NOT NULL THEN
    SELECT count(*) INTO consecutive_high FROM (
      SELECT overall_score FROM carity_inspection_reports
       WHERE submitted_by_user_id = r.submitted_by_user_id AND completed_at IS NOT NULL
       ORDER BY completed_at DESC LIMIT 5
    ) x WHERE overall_score >= 90;
    IF consecutive_high >= 5 THEN
      flags := flags || jsonb_build_array(jsonb_build_object('code','technician_streak','severity','medium','msg','5 inspeções consecutivas com score >= 90 pelo mesmo técnico'));
      score := score + 10;
    END IF;
  END IF;

  IF score > 100 THEN score := 100; END IF;
  IF score < 0 THEN score := 0; END IF;
  lvl := CASE WHEN score <= 30 THEN 'low' WHEN score <= 70 THEN 'medium' ELSE 'high' END;

  UPDATE carity_inspection_reports
    SET risk_score = score, risk_level = lvl, risk_flags = flags,
        risk_calculated_at = now(),
        inspection_duration_seconds = COALESCE(inspection_duration_seconds, duration),
        audit_status = CASE
          WHEN audit_status IN ('in_review','resolved','failed') THEN audit_status
          WHEN score > 60 THEN 'queued' ELSE 'none'
        END
    WHERE id = _report_id;

  IF score > 60 THEN
    IF NOT EXISTS (
      SELECT 1 FROM audit_risk_flags
       WHERE entity_type='inspection_report' AND entity_id=_report_id
         AND flag_type='inspection_high_risk'
         AND created_at > now() - interval '7 days'
    ) THEN
      INSERT INTO audit_risk_flags (flag_type, entity_type, entity_id, severity, description, details)
      VALUES ('inspection_high_risk', 'inspection_report', _report_id,
              CASE WHEN score >= 80 THEN 'critical' ELSE 'high' END,
              format('Inspeção com risco %s/100', score),
              jsonb_build_object('risk_score', score, 'risk_level', lvl, 'flags', flags, 'shop_id', r.shop_id));
    END IF;
  END IF;
END;
$$;
