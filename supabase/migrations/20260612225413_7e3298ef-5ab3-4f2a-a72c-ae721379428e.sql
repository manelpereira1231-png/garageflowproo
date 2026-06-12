
-- ============ 1. HELP CENTER / KNOWLEDGE BASE ============
CREATE TABLE IF NOT EXISTS public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  context text NOT NULL DEFAULT 'erp', -- erp|market|both
  body_md text NOT NULL,
  tags text[] DEFAULT '{}',
  language text NOT NULL DEFAULT 'pt-PT',
  is_faq boolean DEFAULT false,
  is_published boolean DEFAULT true,
  views_count int DEFAULT 0,
  helpful_count int DEFAULT 0,
  not_helpful_count int DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.kb_articles TO anon, authenticated;
GRANT ALL ON public.kb_articles TO service_role;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb public read published" ON public.kb_articles FOR SELECT USING (is_published = true);
CREATE POLICY "kb admin all" ON public.kb_articles FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_kb_articles_search ON public.kb_articles USING gin (to_tsvector('simple', title || ' ' || body_md));
CREATE INDEX IF NOT EXISTS idx_kb_articles_ctx ON public.kb_articles (context, is_faq, is_published);

-- ============ 2. COMPLAINTS / RECLAMAÇÕES ============
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  shop_id uuid,
  context text NOT NULL DEFAULT 'erp',
  category text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'normal', -- low|normal|high|critical
  status text NOT NULL DEFAULT 'open', -- open|investigating|resolved|rejected|closed
  related_entity_type text,
  related_entity_id uuid,
  resolution_notes text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  sla_due_at timestamptz,
  sla_breached boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "complaints owner read" ON public.complaints FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "complaints insert auth" ON public.complaints FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "complaints admin manage" ON public.complaints FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints (status, severity, created_at DESC);

-- ============ 3. SLA CONFIG ============
CREATE TABLE IF NOT EXISTS public.sla_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL, -- support|complaints|escrow_dispute
  severity text NOT NULL, -- low|normal|high|critical|urgent
  first_response_minutes int NOT NULL,
  resolution_hours int NOT NULL,
  active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (scope, severity)
);
GRANT SELECT ON public.sla_config TO authenticated;
GRANT ALL ON public.sla_config TO service_role;
ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla read auth" ON public.sla_config FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sla admin manage" ON public.sla_config FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.sla_config (scope, severity, first_response_minutes, resolution_hours) VALUES
  ('support','low',1440,168),('support','normal',480,72),('support','high',120,24),('support','urgent',30,8),
  ('complaints','normal',720,120),('complaints','high',240,48),('complaints','critical',60,24),
  ('escrow_dispute','normal',480,120),('escrow_dispute','high',120,48)
ON CONFLICT (scope, severity) DO NOTHING;

-- ============ 4. BUSINESS METRICS DAILY SNAPSHOT (MRR/ARR/Churn/LTV) ============
CREATE TABLE IF NOT EXISTS public.business_metrics_daily (
  snapshot_date date PRIMARY KEY,
  mrr_eur numeric DEFAULT 0,
  arr_eur numeric DEFAULT 0,
  paying_customers int DEFAULT 0,
  trial_customers int DEFAULT 0,
  new_signups int DEFAULT 0,
  churned_customers int DEFAULT 0,
  churn_rate numeric DEFAULT 0,
  ltv_eur numeric DEFAULT 0,
  cac_eur numeric DEFAULT 0,
  payback_months numeric DEFAULT 0,
  arpu_eur numeric DEFAULT 0,
  market_gmv_eur numeric DEFAULT 0,
  market_commission_eur numeric DEFAULT 0,
  computed_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.business_metrics_daily TO authenticated;
GRANT ALL ON public.business_metrics_daily TO service_role;
ALTER TABLE public.business_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metrics admin read" ON public.business_metrics_daily FOR SELECT USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.compute_business_metrics_snapshot()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_mrr numeric := 0; v_paying int := 0; v_trial int := 0;
  v_new int := 0; v_churn int := 0; v_churn_rate numeric := 0;
  v_ltv numeric := 0; v_arpu numeric := 0; v_gmv numeric := 0; v_comm numeric := 0;
  v_active_prev int := 0;
BEGIN
  -- MRR: active paid subscriptions w/ stripe_subscription_id (excludes trials/free)
  SELECT COALESCE(SUM(
    CASE WHEN billing_cycle='yearly' THEN COALESCE(amount,0)/12.0 ELSE COALESCE(amount,0) END
  ),0), COUNT(*) FILTER (WHERE status='active' AND stripe_subscription_id IS NOT NULL)
  INTO v_mrr, v_paying
  FROM public.subscriptions
  WHERE status='active' AND stripe_subscription_id IS NOT NULL;

  SELECT COUNT(*) INTO v_trial FROM public.subscriptions WHERE status='trialing';
  SELECT COUNT(*) INTO v_new FROM public.shops WHERE created_at::date = CURRENT_DATE;
  SELECT COUNT(*) INTO v_churn FROM public.subscriptions
    WHERE status IN ('canceled','past_due') AND updated_at::date = CURRENT_DATE;

  SELECT COUNT(*) INTO v_active_prev FROM public.subscriptions
    WHERE status='active' AND created_at < CURRENT_DATE - 30;
  IF v_active_prev > 0 THEN v_churn_rate := v_churn::numeric / v_active_prev; END IF;

  IF v_paying > 0 THEN
    v_arpu := v_mrr / v_paying;
    -- LTV = ARPU / churn_rate (cap when churn=0)
    v_ltv := CASE WHEN v_churn_rate > 0 THEN v_arpu / v_churn_rate ELSE v_arpu * 36 END;
  END IF;

  SELECT COALESCE(SUM(amount),0), COALESCE(SUM(commission_amount),0)
  INTO v_gmv, v_comm
  FROM public.market_escrow
  WHERE status IN ('released','delivery_confirmed') AND released_at::date = CURRENT_DATE;

  INSERT INTO public.business_metrics_daily
    (snapshot_date, mrr_eur, arr_eur, paying_customers, trial_customers,
     new_signups, churned_customers, churn_rate, ltv_eur, arpu_eur,
     market_gmv_eur, market_commission_eur, computed_at)
  VALUES (CURRENT_DATE, v_mrr, v_mrr*12, v_paying, v_trial, v_new, v_churn,
     v_churn_rate, v_ltv, v_arpu, v_gmv, v_comm, now())
  ON CONFLICT (snapshot_date) DO UPDATE SET
    mrr_eur=EXCLUDED.mrr_eur, arr_eur=EXCLUDED.arr_eur,
    paying_customers=EXCLUDED.paying_customers, trial_customers=EXCLUDED.trial_customers,
    new_signups=EXCLUDED.new_signups, churned_customers=EXCLUDED.churned_customers,
    churn_rate=EXCLUDED.churn_rate, ltv_eur=EXCLUDED.ltv_eur, arpu_eur=EXCLUDED.arpu_eur,
    market_gmv_eur=EXCLUDED.market_gmv_eur, market_commission_eur=EXCLUDED.market_commission_eur,
    computed_at=now();

  RETURN jsonb_build_object('mrr',v_mrr,'paying',v_paying,'churn_rate',v_churn_rate,'ltv',v_ltv);
END $$;

-- ============ 5. CUSTOMER HEALTH / CHURN PREDICTION ============
CREATE TABLE IF NOT EXISTS public.customer_health_scores (
  shop_id uuid PRIMARY KEY,
  health_score int NOT NULL DEFAULT 50,
  churn_risk text NOT NULL DEFAULT 'medium', -- low|medium|high|critical
  activity_7d int DEFAULT 0,
  activity_30d int DEFAULT 0,
  activity_drop_pct numeric DEFAULT 0,
  last_login_at timestamptz,
  last_invoice_at timestamptz,
  predicted_churn_date date,
  recommended_action text,
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.customer_health_scores TO authenticated;
GRANT ALL ON public.customer_health_scores TO service_role;
ALTER TABLE public.customer_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health admin read" ON public.customer_health_scores FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "health shop owner read" ON public.customer_health_scores FOR SELECT USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())));

CREATE OR REPLACE FUNCTION public.compute_customer_health()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count int := 0; r record;
BEGIN
  FOR r IN SELECT id FROM public.shops LOOP
    DECLARE
      a7 int; a30 int; drop_pct numeric := 0; score int := 50; risk text := 'medium';
      action text := NULL;
    BEGIN
      SELECT COUNT(*) INTO a7 FROM public.event_logs WHERE shop_id = r.id AND created_at > now() - interval '7 days';
      SELECT COUNT(*) INTO a30 FROM public.event_logs WHERE shop_id = r.id AND created_at > now() - interval '30 days';
      IF a30 > 0 THEN drop_pct := 1 - (a7::numeric / GREATEST(a30/4.0, 1)); END IF;

      score := LEAST(100, GREATEST(0, 50 + a7*2 - CASE WHEN drop_pct > 0.5 THEN 30 ELSE 0 END));
      risk := CASE
        WHEN score >= 75 THEN 'low'
        WHEN score >= 50 THEN 'medium'
        WHEN score >= 25 THEN 'high'
        ELSE 'critical' END;

      IF drop_pct >= 0.8 THEN
        action := 'urgent_outreach';
        -- Trigger growth opportunity
        INSERT INTO public.growth_opportunities_v2
          (entity_type, entity_id, opportunity_type, score, action_priority, auto_action_eligible, metadata)
        VALUES ('shop', r.id, 'churn_risk', 90, 'high', true,
          jsonb_build_object('drop_pct', drop_pct, 'a7', a7, 'a30', a30))
        ON CONFLICT DO NOTHING;
      ELSIF risk='high' THEN action := 'send_reactivation_email';
      ELSIF risk='low' THEN action := 'upsell_candidate';
      END IF;

      INSERT INTO public.customer_health_scores
        (shop_id, health_score, churn_risk, activity_7d, activity_30d, activity_drop_pct, recommended_action, updated_at)
      VALUES (r.id, score, risk, a7, a30, drop_pct, action, now())
      ON CONFLICT (shop_id) DO UPDATE SET
        health_score=EXCLUDED.health_score, churn_risk=EXCLUDED.churn_risk,
        activity_7d=EXCLUDED.activity_7d, activity_30d=EXCLUDED.activity_30d,
        activity_drop_pct=EXCLUDED.activity_drop_pct,
        recommended_action=EXCLUDED.recommended_action, updated_at=now();
      v_count := v_count + 1;
    END;
  END LOOP;
  RETURN jsonb_build_object('processed', v_count, 'timestamp', now());
END $$;

-- ============ 6. WORKSHOP PRODUCTIVITY SNAPSHOTS ============
CREATE TABLE IF NOT EXISTS public.workshop_productivity_daily (
  shop_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  avg_repair_minutes numeric DEFAULT 0,
  completed_orders int DEFAULT 0,
  active_technicians int DEFAULT 0,
  utilization_rate numeric DEFAULT 0,
  upcoming_workload int DEFAULT 0,
  forecast_revenue_eur numeric DEFAULT 0,
  computed_at timestamptz DEFAULT now(),
  PRIMARY KEY (shop_id, snapshot_date)
);
GRANT SELECT ON public.workshop_productivity_daily TO authenticated;
GRANT ALL ON public.workshop_productivity_daily TO service_role;
ALTER TABLE public.workshop_productivity_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod shop read" ON public.workshop_productivity_daily FOR SELECT
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));

-- ============ 7. SLA BREACH AUTO-FLAG TRIGGER ============
CREATE OR REPLACE FUNCTION public.tg_complaints_set_sla()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_hours int;
BEGIN
  SELECT resolution_hours INTO v_hours FROM public.sla_config
    WHERE scope='complaints' AND severity=NEW.severity AND active=true LIMIT 1;
  IF v_hours IS NOT NULL AND NEW.sla_due_at IS NULL THEN
    NEW.sla_due_at := NEW.created_at + make_interval(hours => v_hours);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_complaints_sla ON public.complaints;
CREATE TRIGGER trg_complaints_sla BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.tg_complaints_set_sla();

CREATE TRIGGER trg_complaints_updated BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_kb_updated BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
