
-- ============================================================
-- 1. COHERENCE VALIDATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_inspection_coherence(
  _listing_id uuid,
  _report_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _listing RECORD;
  _report RECORD;
  _warnings jsonb := '[]'::jsonb;
  _coherence_score int := 100;
  _photo_count int;
  _required_photo_types text[] := ARRAY['exterior_photos','interior_photos','engine_photos'];
  _duplicate_count int;
  _all_photos jsonb;
  _photo_arr text[];
  _unique_arr text[];
BEGIN
  -- Get listing
  SELECT * INTO _listing FROM carity_listings WHERE id = _listing_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Listing not found');
  END IF;

  -- Get report
  SELECT * INTO _report FROM carity_inspection_reports WHERE id = _report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Report not found');
  END IF;

  -- ---- CHECK 1: Mileage vs condition coherence ----
  -- High mileage (>200k) should have some wear indicators
  IF _listing.mileage > 200000 THEN
    IF _report.engine_status = 'ok' 
       AND _report.brakes_status = 'ok' 
       AND _report.suspension_status = 'ok' 
       AND _report.tires_status = 'ok'
       AND _report.transmission_status = 'ok' THEN
      _warnings := _warnings || jsonb_build_array(jsonb_build_object(
        'type', 'mileage_condition_mismatch',
        'severity', 'medium',
        'message', 'Veículo com >200.000km mas todos os componentes em estado perfeito — verificar coerência'
      ));
      _coherence_score := _coherence_score - 15;
    END IF;
  END IF;

  -- Very low mileage (<30k) on old cars (>10 years) is suspicious
  IF _listing.mileage < 30000 AND _listing.year < (EXTRACT(YEAR FROM now())::int - 10) THEN
    _warnings := _warnings || jsonb_build_array(jsonb_build_object(
      'type', 'suspiciously_low_mileage',
      'severity', 'high',
      'message', format('Veículo de %s com apenas %s km — possível manipulação de odómetro', _listing.year, _listing.mileage)
    ));
    _coherence_score := _coherence_score - 25;
  END IF;

  -- ---- CHECK 2: Photo completeness ----
  -- Check each required photo type has at least 1 photo
  IF jsonb_array_length(COALESCE(_report.exterior_photos, '[]'::jsonb)) = 0 THEN
    _warnings := _warnings || jsonb_build_array(jsonb_build_object(
      'type', 'missing_photos',
      'severity', 'high',
      'message', 'Fotos exteriores em falta no relatório de inspeção'
    ));
    _coherence_score := _coherence_score - 20;
  END IF;

  IF jsonb_array_length(COALESCE(_report.interior_photos, '[]'::jsonb)) = 0 THEN
    _warnings := _warnings || jsonb_build_array(jsonb_build_object(
      'type', 'missing_photos',
      'severity', 'high',
      'message', 'Fotos interiores em falta no relatório de inspeção'
    ));
    _coherence_score := _coherence_score - 20;
  END IF;

  IF jsonb_array_length(COALESCE(_report.engine_photos, '[]'::jsonb)) = 0 THEN
    _warnings := _warnings || jsonb_build_array(jsonb_build_object(
      'type', 'missing_photos',
      'severity', 'medium',
      'message', 'Fotos do motor em falta no relatório de inspeção'
    ));
    _coherence_score := _coherence_score - 10;
  END IF;

  -- ---- CHECK 3: Duplicate photo detection ----
  -- Merge all photo URLs and check for duplicates
  _all_photos := COALESCE(_report.exterior_photos, '[]'::jsonb) 
    || COALESCE(_report.interior_photos, '[]'::jsonb) 
    || COALESCE(_report.engine_photos, '[]'::jsonb)
    || COALESCE(_report.tire_photos, '[]'::jsonb)
    || COALESCE(_report.damage_photos, '[]'::jsonb);
  
  SELECT array_agg(val) INTO _photo_arr
  FROM jsonb_array_elements_text(_all_photos) AS val;
  
  IF _photo_arr IS NOT NULL THEN
    SELECT array_agg(DISTINCT val) INTO _unique_arr FROM unnest(_photo_arr) AS val;
    _duplicate_count := array_length(_photo_arr, 1) - array_length(_unique_arr, 1);
    
    IF _duplicate_count > 0 THEN
      _warnings := _warnings || jsonb_build_array(jsonb_build_object(
        'type', 'duplicate_photos',
        'severity', 'high',
        'message', format('%s foto(s) duplicada(s) detetada(s) no relatório', _duplicate_count)
      ));
      _coherence_score := _coherence_score - (_duplicate_count * 10);
    END IF;
  END IF;

  -- ---- CHECK 4: Score vs defects coherence ----
  -- High score but many defects is suspicious
  IF _report.overall_score >= 85 AND jsonb_array_length(COALESCE(_report.defects, '[]'::jsonb)) >= 3 THEN
    _warnings := _warnings || jsonb_build_array(jsonb_build_object(
      'type', 'score_defects_mismatch',
      'severity', 'medium',
      'message', format('Score de %s/100 mas %s defeitos registados — verificar pontuação', _report.overall_score, jsonb_array_length(_report.defects))
    ));
    _coherence_score := _coherence_score - 15;
  END IF;

  -- Low score but zero defects is also suspicious
  IF _report.overall_score < 60 AND jsonb_array_length(COALESCE(_report.defects, '[]'::jsonb)) = 0 THEN
    _warnings := _warnings || jsonb_build_array(jsonb_build_object(
      'type', 'score_defects_mismatch',
      'severity', 'medium',
      'message', format('Score de %s/100 mas nenhum defeito registado — justificação necessária', _report.overall_score)
    ));
    _coherence_score := _coherence_score - 10;
  END IF;

  -- ---- CHECK 5: Critical components vs recommendation ----
  IF _report.recommendation = 'recommended' AND (
    _report.brakes_status = 'critical' OR _report.engine_status = 'critical' OR _report.steering_status = 'critical'
  ) THEN
    _warnings := _warnings || jsonb_build_array(jsonb_build_object(
      'type', 'recommendation_mismatch',
      'severity', 'critical',
      'message', 'Veículo marcado como "Recomendado" mas tem componentes críticos — BLOQUEAR publicação'
    ));
    _coherence_score := _coherence_score - 30;
  END IF;

  -- Clamp score
  IF _coherence_score < 0 THEN _coherence_score := 0; END IF;

  RETURN jsonb_build_object(
    'valid', _coherence_score >= 50,
    'coherence_score', _coherence_score,
    'warnings', _warnings,
    'warning_count', jsonb_array_length(_warnings),
    'can_publish', _coherence_score >= 50 AND _report.overall_score >= 60
  );
END;
$$;

-- ============================================================
-- 2. AUDIT RISK FLAGS TABLE
-- ============================================================

CREATE TABLE public.audit_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  description text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  auto_resolved boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_risk_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage risk flags"
  ON public.audit_risk_flags FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX idx_risk_flags_entity ON public.audit_risk_flags(entity_type, entity_id);
CREATE INDEX idx_risk_flags_severity ON public.audit_risk_flags(severity, auto_resolved);

-- ============================================================
-- 3. PROACTIVE AUDIT FUNCTION (flags suspicious patterns)
-- ============================================================

CREATE OR REPLACE FUNCTION public.flag_suspicious_transactions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _flagged int := 0;
  _rec RECORD;
BEGIN
  -- FLAG 1: High-value transactions (>€25k) not yet reviewed
  FOR _rec IN
    SELECT id, listing_id, seller_id, buyer_id, amount
    FROM market_escrow
    WHERE amount > 25000
      AND status IN ('paid', 'delivery_confirmed')
      AND NOT EXISTS (
        SELECT 1 FROM audit_risk_flags 
        WHERE entity_id = market_escrow.id 
        AND flag_type = 'high_value_transaction'
      )
  LOOP
    INSERT INTO audit_risk_flags (flag_type, entity_type, entity_id, severity, description, details)
    VALUES (
      'high_value_transaction', 'market_escrow', _rec.id, 'high',
      format('Transação de alto valor: €%s', _rec.amount),
      jsonb_build_object('amount', _rec.amount, 'seller_id', _rec.seller_id, 'buyer_id', _rec.buyer_id)
    );
    _flagged := _flagged + 1;
  END LOOP;

  -- FLAG 2: Rapid seller activity (3+ sales in 7 days)
  FOR _rec IN
    SELECT seller_id, count(*) as sale_count
    FROM market_escrow
    WHERE created_at > now() - interval '7 days'
      AND status IN ('paid', 'delivery_confirmed', 'released')
    GROUP BY seller_id
    HAVING count(*) >= 3
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM audit_risk_flags 
      WHERE entity_id = _rec.seller_id 
      AND flag_type = 'rapid_seller_activity'
      AND created_at > now() - interval '7 days'
    ) THEN
      INSERT INTO audit_risk_flags (flag_type, entity_type, entity_id, severity, description, details)
      VALUES (
        'rapid_seller_activity', 'user', _rec.seller_id, 'medium',
        format('Vendedor com %s transações nos últimos 7 dias', _rec.sale_count),
        jsonb_build_object('sale_count', _rec.sale_count, 'period', '7_days')
      );
      _flagged := _flagged + 1;
    END IF;
  END LOOP;

  -- FLAG 3: Stale escrow — paid but no delivery after 7+ days
  FOR _rec IN
    SELECT id, listing_id, seller_id, buyer_id, amount, created_at
    FROM market_escrow
    WHERE status = 'paid'
      AND created_at < now() - interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM audit_risk_flags 
        WHERE entity_id = market_escrow.id 
        AND flag_type = 'stale_escrow'
      )
  LOOP
    INSERT INTO audit_risk_flags (flag_type, entity_type, entity_id, severity, description, details)
    VALUES (
      'stale_escrow', 'market_escrow', _rec.id, 'high',
      format('Escrow pago há mais de 7 dias sem confirmação de entrega — €%s', _rec.amount),
      jsonb_build_object('amount', _rec.amount, 'created_at', _rec.created_at, 'seller_id', _rec.seller_id)
    );
    _flagged := _flagged + 1;
  END LOOP;

  -- FLAG 4: Sellers with low trust score + active listings
  FOR _rec IN
    SELECT sts.user_id, sts.trust_level, sts.score_points, sts.disputed_sales,
           count(cl.id) as active_listings
    FROM seller_trust_scores sts
    JOIN carity_listings cl ON cl.seller_id = sts.user_id AND cl.status = 'published'
    WHERE sts.disputed_sales >= 2 AND sts.trust_level = 'bronze'
    GROUP BY sts.user_id, sts.trust_level, sts.score_points, sts.disputed_sales
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM audit_risk_flags 
      WHERE entity_id = _rec.user_id 
      AND flag_type = 'low_trust_active_seller'
      AND created_at > now() - interval '30 days'
    ) THEN
      INSERT INTO audit_risk_flags (flag_type, entity_type, entity_id, severity, description, details)
      VALUES (
        'low_trust_active_seller', 'user', _rec.user_id, 'high',
        format('Vendedor com trust "bronze" e %s disputas tem %s anúncios ativos', _rec.disputed_sales, _rec.active_listings),
        jsonb_build_object('trust_level', _rec.trust_level, 'disputed_sales', _rec.disputed_sales, 'active_listings', _rec.active_listings)
      );
      _flagged := _flagged + 1;
    END IF;
  END LOOP;

  -- FLAG 5: Random 5% sampling of completed transactions
  FOR _rec IN
    SELECT id, listing_id, seller_id, buyer_id, amount
    FROM market_escrow
    WHERE status = 'released'
      AND released_at > now() - interval '30 days'
      AND random() < 0.05
      AND NOT EXISTS (
        SELECT 1 FROM audit_risk_flags 
        WHERE entity_id = market_escrow.id 
        AND flag_type = 'random_audit_sample'
      )
  LOOP
    INSERT INTO audit_risk_flags (flag_type, entity_type, entity_id, severity, description, details)
    VALUES (
      'random_audit_sample', 'market_escrow', _rec.id, 'info',
      format('Amostra aleatória para auditoria — €%s', _rec.amount),
      jsonb_build_object('amount', _rec.amount, 'seller_id', _rec.seller_id, 'buyer_id', _rec.buyer_id)
    );
    _flagged := _flagged + 1;
  END LOOP;

  -- FLAG 6: Chat evasion repeat offenders (3+ attempts)
  FOR _rec IN
    SELECT user_id, count(*) as attempt_count
    FROM audit_logs
    WHERE action = 'chat_fuga_attempt'
      AND created_at > now() - interval '30 days'
    GROUP BY user_id
    HAVING count(*) >= 3
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM audit_risk_flags 
      WHERE entity_id = _rec.user_id 
      AND flag_type = 'chat_evasion_repeat'
      AND created_at > now() - interval '7 days'
    ) THEN
      INSERT INTO audit_risk_flags (flag_type, entity_type, entity_id, severity, description, details)
      VALUES (
        'chat_evasion_repeat', 'user', _rec.user_id, 'high',
        format('Utilizador com %s tentativas de fuga de chat nos últimos 30 dias', _rec.attempt_count),
        jsonb_build_object('attempt_count', _rec.attempt_count)
      );
      _flagged := _flagged + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('flagged', _flagged, 'timestamp', now());
END;
$$;
