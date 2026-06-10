
-- ============================================================
-- 1. GROWTH OPPORTUNITIES v2
-- ============================================================
CREATE TABLE IF NOT EXISTS public.growth_opportunities_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('shop','listing','blog','user')),
  entity_id uuid NOT NULL,
  opportunity_type text NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','actioned','ignored')),
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, opportunity_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_opportunities_v2 TO authenticated;
GRANT ALL ON public.growth_opportunities_v2 TO service_role;

ALTER TABLE public.growth_opportunities_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads growth ops"
  ON public.growth_opportunities_v2 FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin updates growth ops"
  ON public.growth_opportunities_v2 FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_growth_ops_v2_score ON public.growth_opportunities_v2 (score DESC, status);
CREATE INDEX IF NOT EXISTS idx_growth_ops_v2_entity ON public.growth_opportunities_v2 (entity_type, entity_id);

-- Score calculator: traffic + conversion gap + inactivity + engagement
CREATE OR REPLACE FUNCTION public.calculate_opportunity_score(
  _entity_type text,
  _entity_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _views int := 0;
  _contacts int := 0;
  _signups int := 0;
  _reviews int := 0;
  _last_seen timestamptz;
  _days_inactive int := 0;
  _conversion_gap numeric := 0;
  _score numeric := 0;
  _reason text := '';
  _op_type text := 'engagement';
BEGIN
  -- Traffic from event_logs (last 30d)
  SELECT
    count(*) FILTER (WHERE event_name IN ('listing_view','shop_view','page_view')),
    count(*) FILTER (WHERE event_name = 'contact_clicked'),
    count(*) FILTER (WHERE event_name = 'signup'),
    count(*) FILTER (WHERE event_name = 'review_submitted')
  INTO _views, _contacts, _signups, _reviews
  FROM public.event_logs
  WHERE created_at > now() - interval '30 days'
    AND (
      (payload->>'shop_id')::uuid = _entity_id OR
      (payload->>'listing_id')::uuid = _entity_id OR
      (payload->>'entity_id')::uuid = _entity_id OR
      shop_id = _entity_id OR user_id = _entity_id
    );

  -- Inactivity
  SELECT last_seen_at INTO _last_seen FROM public.user_activity
   WHERE (_entity_type = 'user' AND user_id = _entity_id)
      OR (_entity_type = 'shop' AND shop_id = _entity_id)
   ORDER BY last_seen_at DESC LIMIT 1;

  IF _last_seen IS NOT NULL THEN
    _days_inactive := GREATEST(0, EXTRACT(DAY FROM (now() - _last_seen))::int);
  END IF;

  -- Conversion gap: high views, low contacts
  IF _views > 0 THEN
    _conversion_gap := 1.0 - LEAST(1.0, _contacts::numeric / GREATEST(_views, 1));
  END IF;

  -- Compose score (0-100)
  _score := LEAST(100,
      LEAST(40, _views * 0.4)                       -- traffic up to 40
    + (_conversion_gap * 30)                        -- conversion gap up to 30
    + LEAST(20, _days_inactive * 0.5)               -- inactivity up to 20
    + LEAST(10, _reviews * 2)                       -- engagement up to 10
  );

  IF _views >= 50 AND _contacts = 0 THEN
    _op_type := 'high_traffic_no_conversion';
    _reason := format('%s views em 30d sem contactos', _views);
  ELSIF _days_inactive > 14 THEN
    _op_type := 'inactivity_reengage';
    _reason := format('Sem atividade há %s dias', _days_inactive);
  ELSIF _views = 0 THEN
    _op_type := 'low_visibility';
    _reason := 'Sem tráfego nos últimos 30 dias';
  ELSE
    _reason := format('Score baseado em %s views, %s contactos, %s dias inativo', _views, _contacts, _days_inactive);
  END IF;

  -- Upsert
  INSERT INTO public.growth_opportunities_v2
    (entity_type, entity_id, opportunity_type, score, reason, last_calculated_at)
  VALUES (_entity_type, _entity_id, _op_type, _score, _reason, now())
  ON CONFLICT (entity_type, entity_id, opportunity_type)
  DO UPDATE SET score = EXCLUDED.score,
                reason = EXCLUDED.reason,
                last_calculated_at = now(),
                status = CASE WHEN public.growth_opportunities_v2.status = 'ignored'
                              THEN 'ignored' ELSE 'new' END;

  RETURN jsonb_build_object(
    'score', _score, 'type', _op_type, 'reason', _reason,
    'views', _views, 'contacts', _contacts, 'days_inactive', _days_inactive
  );
END;
$$;

-- Batch recalculation (cron-friendly)
CREATE OR REPLACE FUNCTION public.recalculate_all_growth_opportunities()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _shop record; _processed int := 0;
BEGIN
  FOR _shop IN SELECT id FROM public.shops LIMIT 500 LOOP
    PERFORM public.calculate_opportunity_score('shop', _shop.id);
    _processed := _processed + 1;
  END LOOP;
  RETURN jsonb_build_object('processed', _processed, 'at', now());
END;
$$;

-- ============================================================
-- 2. RATE LIMITS (central anti-abuse)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,                -- user_id or ip
  action_type text NOT NULL,
  count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO authenticated;
GRANT ALL ON public.rate_limits TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads rate limits"
  ON public.rate_limits FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.rate_limits (identifier, action_type, window_start DESC);

-- check_rate_limit: returns true if ALLOWED, false if blocked
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _action_type text,
  _identifier text,
  _max_count int DEFAULT 100,
  _window_seconds int DEFAULT 60
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _current int := 0;
  _window_start timestamptz := now() - make_interval(secs => _window_seconds);
BEGIN
  -- Sum recent counts within window
  SELECT COALESCE(SUM(count), 0) INTO _current
  FROM public.rate_limits
  WHERE identifier = _identifier
    AND action_type = _action_type
    AND window_start > _window_start;

  IF _current >= _max_count THEN
    RETURN jsonb_build_object(
      'allowed', false, 'count', _current, 'limit', _max_count,
      'retry_after_seconds', _window_seconds
    );
  END IF;

  -- Record this attempt
  INSERT INTO public.rate_limits (identifier, action_type, count, window_start)
  VALUES (_identifier, _action_type, 1, now());

  RETURN jsonb_build_object('allowed', true, 'count', _current + 1, 'limit', _max_count);
END;
$$;

-- Cleanup old entries
CREATE OR REPLACE FUNCTION public.purge_old_rate_limits()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '24 hours';
$$;

-- ============================================================
-- 3. EMAIL TRACKING EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('sent','opened','clicked','bounced','failed')),
  user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_tracking_events TO authenticated;
GRANT ALL ON public.email_tracking_events TO service_role;

ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads email tracking"
  ON public.email_tracking_events FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_email_tracking_email_id ON public.email_tracking_events (email_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_event_type ON public.email_tracking_events (event_type, created_at DESC);
