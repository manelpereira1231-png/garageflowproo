
-- Add integrity and lock fields to inspection reports
ALTER TABLE public.carity_inspection_reports 
  ADD COLUMN IF NOT EXISTS report_hash text,
  ADD COLUMN IF NOT EXISTS submitted_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS technician_name text,
  ADD COLUMN IF NOT EXISTS locked_at timestamp with time zone;

-- Function to generate SHA-256 hash of report data
CREATE OR REPLACE FUNCTION public.generate_report_hash(_report_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _report RECORD;
  _hash_input text;
BEGIN
  SELECT * INTO _report FROM carity_inspection_reports WHERE id = _report_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  _hash_input := _report.id::text 
    || '|' || _report.inspection_id::text
    || '|' || _report.listing_id::text
    || '|' || _report.shop_id::text
    || '|' || COALESCE(_report.submitted_by_user_id::text, '')
    || '|' || _report.engine_status
    || '|' || _report.transmission_status
    || '|' || _report.brakes_status
    || '|' || _report.suspension_status
    || '|' || _report.steering_status
    || '|' || _report.tires_status
    || '|' || _report.electrical_status
    || '|' || _report.overall_score::text
    || '|' || _report.recommendation
    || '|' || COALESCE(_report.inspector_notes, '')
    || '|' || _report.defects::text
    || '|' || _report.exterior_photos::text
    || '|' || _report.interior_photos::text
    || '|' || _report.engine_photos::text
    || '|' || _report.tire_photos::text
    || '|' || _report.damage_photos::text
    || '|' || COALESCE(_report.technician_name, '')
    || '|' || COALESCE(_report.completed_at::text, '');

  RETURN encode(digest(_hash_input, 'sha256'), 'hex');
END;
$$;

-- Function to detect workshop anomalies (100% perfect, no defects ever, etc.)
CREATE OR REPLACE FUNCTION public.detect_workshop_anomalies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _flagged int := 0;
  _rec RECORD;
BEGIN
  -- ANOMALY 1: Workshops with 100% "recommended" rate (min 5 reports)
  FOR _rec IN
    SELECT shop_id, 
           COUNT(*) as total_reports,
           COUNT(*) FILTER (WHERE recommendation = 'recommended') as recommended_count,
           ROUND(COUNT(*) FILTER (WHERE recommendation = 'recommended')::numeric / COUNT(*)::numeric * 100) as approval_rate
    FROM carity_inspection_reports
    WHERE completed_at IS NOT NULL
    GROUP BY shop_id
    HAVING COUNT(*) >= 5 
      AND COUNT(*) FILTER (WHERE recommendation = 'recommended') = COUNT(*)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM audit_risk_flags 
      WHERE entity_id = _rec.shop_id 
      AND flag_type = 'workshop_100pct_approval'
      AND created_at > now() - interval '30 days'
    ) THEN
      INSERT INTO audit_risk_flags (flag_type, entity_type, entity_id, severity, description, details)
      VALUES (
        'workshop_100pct_approval', 'shop', _rec.shop_id, 'high',
        format('Oficina com 100%% aprovação em %s inspeções — padrão suspeito', _rec.total_reports),
        jsonb_build_object('total_reports', _rec.total_reports, 'approval_rate', _rec.approval_rate)
      );
      _flagged := _flagged + 1;
    END IF;
  END LOOP;

  -- ANOMALY 2: Workshops that never report defects (min 5 reports)
  FOR _rec IN
    SELECT shop_id, COUNT(*) as total_reports
    FROM carity_inspection_reports
    WHERE completed_at IS NOT NULL
    GROUP BY shop_id
    HAVING COUNT(*) >= 5 
      AND COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(defects, '[]'::jsonb)) > 0) = 0
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM audit_risk_flags 
      WHERE entity_id = _rec.shop_id 
      AND flag_type = 'workshop_zero_defects'
      AND created_at > now() - interval '30 days'
    ) THEN
      INSERT INTO audit_risk_flags (flag_type, entity_type, entity_id, severity, description, details)
      VALUES (
        'workshop_zero_defects', 'shop', _rec.shop_id, 'medium',
        format('Oficina com %s inspeções e zero defeitos reportados — anomalia estatística', _rec.total_reports),
        jsonb_build_object('total_reports', _rec.total_reports)
      );
      _flagged := _flagged + 1;
    END IF;
  END LOOP;

  -- ANOMALY 3: All scores suspiciously similar (std dev < 3 on 5+ reports)
  FOR _rec IN
    SELECT shop_id, 
           COUNT(*) as total_reports,
           ROUND(AVG(overall_score)::numeric, 1) as avg_score,
           ROUND(STDDEV(overall_score)::numeric, 1) as score_stddev
    FROM carity_inspection_reports
    WHERE completed_at IS NOT NULL
    GROUP BY shop_id
    HAVING COUNT(*) >= 5 AND STDDEV(overall_score) < 3
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM audit_risk_flags 
      WHERE entity_id = _rec.shop_id 
      AND flag_type = 'workshop_uniform_scores'
      AND created_at > now() - interval '30 days'
    ) THEN
      INSERT INTO audit_risk_flags (flag_type, entity_type, entity_id, severity, description, details)
      VALUES (
        'workshop_uniform_scores', 'shop', _rec.shop_id, 'medium',
        format('Oficina com scores quase idênticos (média %s, desvio %s) em %s inspeções', _rec.avg_score, _rec.score_stddev, _rec.total_reports),
        jsonb_build_object('avg_score', _rec.avg_score, 'score_stddev', _rec.score_stddev, 'total_reports', _rec.total_reports)
      );
      _flagged := _flagged + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('flagged', _flagged, 'timestamp', now());
END;
$$;

-- Drop conflicting policy if exists, then create updated one
DROP POLICY IF EXISTS "Block updates on locked reports" ON public.carity_inspection_reports;

CREATE POLICY "Block updates on locked reports"
ON public.carity_inspection_reports
FOR UPDATE
TO authenticated
USING (
  is_locked = false 
  OR is_super_admin(auth.uid())
);
