
-- ============================================================
-- 1. ENTITY_STATE (Single Source of Truth)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entity_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('user','shop','listing','blog')),
  entity_id uuid NOT NULL,
  lifecycle_state text NOT NULL DEFAULT 'new' CHECK (lifecycle_state IN ('new','active','cold','churned','reactivated')),
  health_score integer NOT NULL DEFAULT 50 CHECK (health_score BETWEEN 0 AND 100),
  conversion_score integer NOT NULL DEFAULT 0 CHECK (conversion_score BETWEEN 0 AND 100),
  last_activity_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

GRANT SELECT ON public.entity_state TO authenticated;
GRANT ALL ON public.entity_state TO service_role;
ALTER TABLE public.entity_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_state_admin_read" ON public.entity_state
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "entity_state_service_all" ON public.entity_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_entity_state_type_state ON public.entity_state(entity_type, lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_entity_state_last_activity ON public.entity_state(last_activity_at DESC);

-- ============================================================
-- 2. GROWTH ENGINE EVOLUTION
-- ============================================================
ALTER TABLE public.growth_opportunities_v2
  ADD COLUMN IF NOT EXISTS recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS action_priority text NOT NULL DEFAULT 'low' CHECK (action_priority IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS auto_action_eligible boolean NOT NULL DEFAULT false;

-- ============================================================
-- 3. FUNNEL EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid,
  entity_type text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('impression','view','intent','action','conversion')),
  user_id uuid,
  source_event text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.funnel_events TO authenticated;
GRANT ALL ON public.funnel_events TO service_role;
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funnel_events_admin_read" ON public.funnel_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "funnel_events_insert_auth" ON public.funnel_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "funnel_events_service_all" ON public.funnel_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_funnel_entity_stage ON public.funnel_events(entity_type, entity_id, stage);
CREATE INDEX IF NOT EXISTS idx_funnel_created_at ON public.funnel_events(created_at DESC);

-- ============================================================
-- 4. SEO GRAPH LINKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seo_graph_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity text NOT NULL,
  source_id text NOT NULL,
  target_entity text NOT NULL,
  target_id text NOT NULL,
  link_type text NOT NULL DEFAULT 'internal' CHECK (link_type IN ('internal','contextual','semantic')),
  weight numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_entity, source_id, target_entity, target_id, link_type)
);

GRANT SELECT ON public.seo_graph_links TO anon, authenticated;
GRANT ALL ON public.seo_graph_links TO service_role;
ALTER TABLE public.seo_graph_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seo_graph_public_read" ON public.seo_graph_links
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "seo_graph_service_all" ON public.seo_graph_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_seo_graph_source ON public.seo_graph_links(source_entity, source_id);
CREATE INDEX IF NOT EXISTS idx_seo_graph_target ON public.seo_graph_links(target_entity, target_id);

-- ============================================================
-- 5. ANOMALY EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.anomaly_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid,
  entity_type text,
  anomaly_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high')),
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.anomaly_events TO authenticated;
GRANT ALL ON public.anomaly_events TO service_role;
ALTER TABLE public.anomaly_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anomaly_admin_read" ON public.anomaly_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "anomaly_service_all" ON public.anomaly_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_anomaly_unresolved ON public.anomaly_events(severity, created_at DESC) WHERE resolved = false;

-- ============================================================
-- 6. EMAIL CAMPAIGN METRICS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  sent_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  open_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  conversion_count integer NOT NULL DEFAULT 0,
  open_rate numeric NOT NULL DEFAULT 0,
  click_rate numeric NOT NULL DEFAULT 0,
  conversion_rate numeric NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id)
);

GRANT SELECT ON public.email_campaign_metrics TO authenticated;
GRANT ALL ON public.email_campaign_metrics TO service_role;
ALTER TABLE public.email_campaign_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_metrics_admin_read" ON public.email_campaign_metrics
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "email_metrics_service_all" ON public.email_campaign_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 7. OBSERVABILITY EXPANSION
-- ============================================================
ALTER TABLE public.api_logs
  ADD COLUMN IF NOT EXISTS trace_id uuid,
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS payload_size integer;

CREATE INDEX IF NOT EXISTS idx_api_logs_trace ON public.api_logs(trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_logs_service ON public.api_logs(service_name);

-- ============================================================
-- 8. RPCs
-- ============================================================

-- Upsert entity state (called by triggers / cron)
CREATE OR REPLACE FUNCTION public.upsert_entity_state(
  _entity_type text,
  _entity_id uuid,
  _lifecycle_state text DEFAULT NULL,
  _health_score integer DEFAULT NULL,
  _conversion_score integer DEFAULT NULL,
  _last_activity_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.entity_state (entity_type, entity_id, lifecycle_state, health_score, conversion_score, last_activity_at)
  VALUES (
    _entity_type, _entity_id,
    COALESCE(_lifecycle_state, 'new'),
    COALESCE(_health_score, 50),
    COALESCE(_conversion_score, 0),
    _last_activity_at
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE
  SET lifecycle_state = COALESCE(EXCLUDED.lifecycle_state, public.entity_state.lifecycle_state),
      health_score = COALESCE(EXCLUDED.health_score, public.entity_state.health_score),
      conversion_score = COALESCE(EXCLUDED.conversion_score, public.entity_state.conversion_score),
      last_activity_at = GREATEST(public.entity_state.last_activity_at, EXCLUDED.last_activity_at),
      updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Record funnel event (consumed by frontend / triggers from event_logs)
CREATE OR REPLACE FUNCTION public.record_funnel_event(
  _entity_type text,
  _entity_id uuid,
  _stage text,
  _user_id uuid DEFAULT NULL,
  _source_event text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.funnel_events (entity_id, entity_type, stage, user_id, source_event, metadata)
  VALUES (_entity_id, _entity_type, _stage, _user_id, _source_event, _metadata)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Generate recommended actions for a growth opportunity
CREATE OR REPLACE FUNCTION public.generate_recommended_actions(
  _score integer,
  _entity_type text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  actions jsonb := '[]'::jsonb;
  views integer := COALESCE((_metadata->>'views')::int, 0);
  contacts integer := COALESCE((_metadata->>'contacts')::int, 0);
  days_inactive integer := COALESCE((_metadata->>'days_inactive')::int, 0);
BEGIN
  IF _entity_type = 'listing' AND views > 50 AND contacts = 0 THEN
    actions := actions || jsonb_build_array(
      jsonb_build_object('type','boost_listing','reason','high views, no contacts'),
      jsonb_build_object('type','price_review','reason','possible price mismatch')
    );
  END IF;

  IF _entity_type = 'shop' AND days_inactive > 14 THEN
    actions := actions || jsonb_build_array(
      jsonb_build_object('type','send_reactivation_email','reason','cold shop')
    );
  END IF;

  IF _entity_type = 'blog' AND _score < 30 THEN
    actions := actions || jsonb_build_array(
      jsonb_build_object('type','seo_internal_link_injection','reason','low authority')
    );
  END IF;

  IF _score >= 80 THEN
    actions := actions || jsonb_build_array(
      jsonb_build_object('type','feature_in_homepage','reason','high score asset')
    );
  END IF;

  RETURN actions;
END;
$$;

-- Detect anomaly (lightweight rule-based)
CREATE OR REPLACE FUNCTION public.detect_anomaly(
  _entity_id uuid,
  _entity_type text,
  _anomaly_type text,
  _severity text DEFAULT 'low',
  _description text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.anomaly_events (entity_id, entity_type, anomaly_type, severity, description, metadata)
  VALUES (_entity_id, _entity_type, _anomaly_type, _severity, _description, _metadata)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Refresh email campaign metrics from email_tracking_events + email_logs
CREATE OR REPLACE FUNCTION public.refresh_email_campaign_metrics(_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sent int := 0;
  v_open int := 0;
  v_click int := 0;
BEGIN
  SELECT COUNT(*) INTO v_sent FROM public.admin_campaign_recipients WHERE campaign_id = _campaign_id;

  SELECT
    COUNT(*) FILTER (WHERE event_type = 'open'),
    COUNT(*) FILTER (WHERE event_type = 'click')
  INTO v_open, v_click
  FROM public.email_tracking_events
  WHERE (metadata->>'campaign_id')::uuid = _campaign_id;

  INSERT INTO public.email_campaign_metrics (campaign_id, sent_count, open_count, click_count,
    open_rate, click_rate, computed_at)
  VALUES (_campaign_id, v_sent, v_open, v_click,
    CASE WHEN v_sent > 0 THEN (v_open::numeric / v_sent) ELSE 0 END,
    CASE WHEN v_sent > 0 THEN (v_click::numeric / v_sent) ELSE 0 END,
    now())
  ON CONFLICT (campaign_id) DO UPDATE
  SET sent_count = EXCLUDED.sent_count,
      open_count = EXCLUDED.open_count,
      click_count = EXCLUDED.click_count,
      open_rate = EXCLUDED.open_rate,
      click_rate = EXCLUDED.click_rate,
      computed_at = now();
END;
$$;

-- updated_at trigger for entity_state
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_entity_state_updated ON public.entity_state;
CREATE TRIGGER trg_entity_state_updated
  BEFORE UPDATE ON public.entity_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_seo_graph_updated ON public.seo_graph_links;
CREATE TRIGGER trg_seo_graph_updated
  BEFORE UPDATE ON public.seo_graph_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT EXECUTE ON FUNCTION public.upsert_entity_state(text,uuid,text,integer,integer,timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_funnel_event(text,uuid,text,uuid,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_recommended_actions(integer,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.detect_anomaly(uuid,text,text,text,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_email_campaign_metrics(uuid) TO authenticated, service_role;
