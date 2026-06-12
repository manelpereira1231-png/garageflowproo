
-- ============================================================
-- PHASE FINAL: Auto-action engine, self-healing, archiving, DLQ
-- ============================================================

-- 1. ACTION QUEUE -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.action_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  trace_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_queue_status_chk CHECK (status IN ('pending','running','success','failed','retrying','skipped'))
);
GRANT SELECT ON public.action_queue TO authenticated;
GRANT ALL ON public.action_queue TO service_role;
ALTER TABLE public.action_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read action_queue" ON public.action_queue FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_action_queue_pending ON public.action_queue (status, scheduled_at) WHERE status IN ('pending','retrying');
CREATE INDEX IF NOT EXISTS idx_action_queue_entity ON public.action_queue (entity_type, entity_id, action_type, created_at DESC);

-- Whitelist of safe action types
CREATE TABLE IF NOT EXISTS public.action_whitelist (
  action_type text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  cooldown_hours int NOT NULL DEFAULT 24,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.action_whitelist TO authenticated;
GRANT ALL ON public.action_whitelist TO service_role;
ALTER TABLE public.action_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "everyone read whitelist" ON public.action_whitelist FOR SELECT TO authenticated USING (true);
INSERT INTO public.action_whitelist (action_type, cooldown_hours, description) VALUES
  ('boost_listing', 72, 'Auto boost listing with high views/no contact'),
  ('send_reactivation_email', 168, 'Send reactivation email to cold shop'),
  ('seo_internal_link_injection', 720, 'Inject internal SEO links'),
  ('feature_in_homepage', 168, 'Feature high-score entity on homepage'),
  ('price_review', 168, 'Notify seller to review price')
ON CONFLICT (action_type) DO NOTHING;

-- 2. ENQUEUE / CLAIM / COMPLETE RPCs ------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_action(
  _entity_type text, _entity_id uuid, _action_type text,
  _payload jsonb DEFAULT '{}'::jsonb, _scheduled_at timestamptz DEFAULT now(), _trace_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid; v_enabled boolean; v_cooldown int; v_recent int;
BEGIN
  -- Whitelist + cooldown check
  SELECT enabled, cooldown_hours INTO v_enabled, v_cooldown
  FROM public.action_whitelist WHERE action_type = _action_type;
  IF NOT FOUND OR v_enabled = false THEN
    RETURN NULL;
  END IF;
  SELECT COUNT(*) INTO v_recent FROM public.action_queue
   WHERE entity_id = _entity_id AND action_type = _action_type
     AND created_at > now() - make_interval(hours => v_cooldown)
     AND status IN ('pending','running','retrying','success');
  IF v_recent > 0 THEN RETURN NULL; END IF;

  INSERT INTO public.action_queue (entity_type, entity_id, action_type, payload, scheduled_at, trace_id)
  VALUES (_entity_type, _entity_id, _action_type, _payload, _scheduled_at, _trace_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.claim_next_actions(_limit int DEFAULT 10)
RETURNS SETOF public.action_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.action_queue q
     SET status = 'running', attempts = attempts + 1, updated_at = now()
   WHERE q.id IN (
     SELECT id FROM public.action_queue
      WHERE status IN ('pending','retrying') AND scheduled_at <= now()
      ORDER BY scheduled_at ASC
      LIMIT _limit FOR UPDATE SKIP LOCKED
   )
   RETURNING q.*;
END $$;

CREATE OR REPLACE FUNCTION public.complete_action(_id uuid, _success boolean, _error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.action_queue WHERE id = _id;
  IF NOT FOUND THEN RETURN; END IF;
  IF _success THEN
    UPDATE public.action_queue SET status='success', last_error=NULL, updated_at=now() WHERE id=_id;
  ELSIF r.attempts >= r.max_attempts THEN
    UPDATE public.action_queue SET status='failed', last_error=_error, updated_at=now() WHERE id=_id;
    INSERT INTO public.failed_jobs (job_type, payload, error, retry_count, source_id)
    VALUES ('action_queue', jsonb_build_object('action_type', r.action_type, 'entity_id', r.entity_id, 'payload', r.payload), _error, r.attempts, r.id);
  ELSE
    UPDATE public.action_queue
       SET status='retrying', last_error=_error,
           scheduled_at = now() + make_interval(mins => (r.attempts * r.attempts * 5)),
           updated_at = now()
     WHERE id = _id;
  END IF;
END $$;

-- 3. DEAD-LETTER QUEUE -------------------------------------------
CREATE TABLE IF NOT EXISTS public.failed_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  retry_count int NOT NULL DEFAULT 0,
  source_id uuid,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.failed_jobs TO authenticated;
GRANT ALL ON public.failed_jobs TO service_role;
ALTER TABLE public.failed_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read failed_jobs" ON public.failed_jobs FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_failed_jobs_unresolved ON public.failed_jobs (resolved, created_at DESC) WHERE resolved = false;

CREATE OR REPLACE FUNCTION public.retry_failed_jobs(_limit int DEFAULT 50)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_count int := 0; v_id uuid;
BEGIN
  FOR r IN SELECT * FROM public.failed_jobs WHERE resolved = false AND job_type = 'action_queue' ORDER BY created_at LIMIT _limit LOOP
    v_id := public.enqueue_action(
      COALESCE(r.payload->>'entity_type','unknown'),
      NULLIF(r.payload->>'entity_id','')::uuid,
      r.payload->>'action_type',
      COALESCE(r.payload->'payload','{}'::jsonb)
    );
    IF v_id IS NOT NULL THEN
      UPDATE public.failed_jobs SET resolved=true, resolved_at=now() WHERE id=r.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;

-- 4. ARCHIVING ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_logs_archive (LIKE public.event_logs INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.funnel_events_archive (LIKE public.funnel_events INCLUDING ALL);
GRANT SELECT ON public.event_logs_archive TO authenticated;
GRANT ALL ON public.event_logs_archive TO service_role;
GRANT SELECT ON public.funnel_events_archive TO authenticated;
GRANT ALL ON public.funnel_events_archive TO service_role;
ALTER TABLE public.event_logs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_events_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read event_archive" ON public.event_logs_archive FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "admins read funnel_archive" ON public.funnel_events_archive FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.archive_old_events(_days int DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_e int := 0; v_f int := 0;
BEGIN
  WITH moved AS (
    DELETE FROM public.event_logs WHERE created_at < now() - make_interval(days => _days) RETURNING *
  ) INSERT INTO public.event_logs_archive SELECT * FROM moved;
  GET DIAGNOSTICS v_e = ROW_COUNT;

  WITH moved AS (
    DELETE FROM public.funnel_events WHERE created_at < now() - make_interval(days => _days) RETURNING *
  ) INSERT INTO public.funnel_events_archive SELECT * FROM moved;
  GET DIAGNOSTICS v_f = ROW_COUNT;

  RETURN jsonb_build_object('events_archived', v_e, 'funnel_archived', v_f, 'timestamp', now());
END $$;

-- 5. AUDIT TRACE -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.action_trace (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id uuid NOT NULL,
  step text NOT NULL,
  source_table text,
  source_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.action_trace TO authenticated;
GRANT ALL ON public.action_trace TO service_role;
ALTER TABLE public.action_trace ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read trace" ON public.action_trace FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_action_trace_trace ON public.action_trace (trace_id, created_at);

-- 6. RECONCILIATION ---------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_entity_state(_limit int DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated int := 0; v_stale int := 0;
BEGIN
  -- Mark entities with no activity in 60 days as 'inactive'
  WITH stale AS (
    UPDATE public.entity_state SET status='inactive', updated_at=now()
     WHERE status='active' AND last_event_at < now() - interval '60 days'
     RETURNING 1
  ) SELECT count(*) INTO v_stale FROM stale;

  -- Refresh score for entities updated recently
  UPDATE public.entity_state es
     SET health_score = LEAST(100, GREATEST(0,
           50
           + COALESCE((SELECT count(*) FROM public.event_logs e WHERE e.shop_id = es.entity_id AND e.created_at > now() - interval '7 days'), 0)
           - CASE WHEN es.last_event_at < now() - interval '30 days' THEN 30 ELSE 0 END
         )),
         updated_at = now()
   WHERE es.entity_id IN (
     SELECT entity_id FROM public.entity_state
      WHERE updated_at < now() - interval '1 day'
      ORDER BY updated_at LIMIT _limit
   );
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('stale_marked', v_stale, 'scores_refreshed', v_updated, 'timestamp', now());
END $$;

-- 7. CLOSED-LOOP PIPELINE ---------------------------------------
CREATE OR REPLACE FUNCTION public.tg_closed_loop_on_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_trace uuid := gen_random_uuid();
BEGIN
  -- Audit trace
  INSERT INTO public.action_trace (trace_id, step, source_table, source_id, metadata)
  VALUES (v_trace, 'event_captured', 'event_logs', NEW.id, jsonb_build_object('event', NEW.event_name));

  -- Update entity_state.last_event_at for shop
  IF NEW.shop_id IS NOT NULL THEN
    INSERT INTO public.entity_state (entity_type, entity_id, status, last_event_at, updated_at)
    VALUES ('shop', NEW.shop_id, 'active', NEW.created_at, now())
    ON CONFLICT (entity_type, entity_id) DO UPDATE
      SET last_event_at = EXCLUDED.last_event_at, status = 'active', updated_at = now();
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never break tracking
END $$;

DROP TRIGGER IF EXISTS trg_closed_loop_event ON public.event_logs;
CREATE TRIGGER trg_closed_loop_event AFTER INSERT ON public.event_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_closed_loop_on_event();

-- 8. PERFORMANCE INDEXES ---------------------------------------
CREATE INDEX IF NOT EXISTS idx_event_logs_entity_created ON public.event_logs (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_event_created ON public.event_logs (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_entity_created ON public.funnel_events (entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_stage_created ON public.funnel_events (stage, created_at DESC);

-- 9. ENFORCE RATE LIMIT WRAPPER --------------------------------
CREATE OR REPLACE FUNCTION public.enforce_rate_limit(_action_type text, _identifier text, _max int DEFAULT 60, _window_seconds int DEFAULT 60)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  r := public.check_rate_limit(_action_type, _identifier, _max, _window_seconds);
  IF NOT COALESCE((r->>'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'rate_limit_exceeded:%', _action_type USING ERRCODE = '54000';
  END IF;
END $$;
