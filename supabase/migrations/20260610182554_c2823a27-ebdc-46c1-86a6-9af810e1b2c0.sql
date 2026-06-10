
-- 1. event_logs
CREATE TABLE IF NOT EXISTS public.event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  shop_id uuid,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_logs_name_created_idx ON public.event_logs(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS event_logs_user_idx ON public.event_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_logs_shop_idx ON public.event_logs(shop_id, created_at DESC);

GRANT SELECT, INSERT ON public.event_logs TO authenticated;
GRANT SELECT, INSERT ON public.event_logs TO anon;
GRANT ALL ON public.event_logs TO service_role;

ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_insert_events" ON public.event_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "admins_read_events" ON public.event_logs FOR SELECT USING (public.is_super_admin(auth.uid()));

-- 2. email_events
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id text NOT NULL,
  email_type text,
  user_id uuid,
  recipient text,
  event_type text NOT NULL, -- sent | opened | clicked | bounced | failed
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_events_email_idx ON public.email_events(email_id);
CREATE INDEX IF NOT EXISTS email_events_type_idx ON public.email_events(event_type, created_at DESC);

GRANT SELECT, INSERT ON public.email_events TO anon;
GRANT SELECT, INSERT ON public.email_events TO authenticated;
GRANT ALL ON public.email_events TO service_role;

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_insert_email_events" ON public.email_events FOR INSERT WITH CHECK (true);
CREATE POLICY "admins_read_email_events" ON public.email_events FOR SELECT USING (public.is_super_admin(auth.uid()));

-- 3. api_logs
CREATE TABLE IF NOT EXISTS public.api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  method text,
  status_code int,
  latency_ms int,
  user_id uuid,
  ip text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_logs_endpoint_idx ON public.api_logs(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS api_logs_status_idx ON public.api_logs(status_code, created_at DESC);

GRANT SELECT ON public.api_logs TO authenticated;
GRANT ALL ON public.api_logs TO service_role;

ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_api_logs" ON public.api_logs FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "service_insert_api_logs" ON public.api_logs FOR INSERT WITH CHECK (true);

-- 4. user_activity
CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id uuid PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_shop_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_activity_seen_idx ON public.user_activity(last_seen_at DESC);

GRANT SELECT ON public.user_activity TO authenticated;
GRANT ALL ON public.user_activity TO service_role;

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_read_own_activity" ON public.user_activity FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

-- 5. track_event RPC
CREATE OR REPLACE FUNCTION public.track_event(
  _event_name text,
  _payload jsonb DEFAULT '{}'::jsonb,
  _shop_id uuid DEFAULT NULL,
  _session_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.event_logs (event_name, payload, user_id, shop_id, session_id)
  VALUES (_event_name, COALESCE(_payload, '{}'::jsonb), auth.uid(), _shop_id, _session_id)
  RETURNING id INTO _id;
  RETURN _id;
END;$$;
GRANT EXECUTE ON FUNCTION public.track_event(text, jsonb, uuid, text) TO anon, authenticated;

-- 6. touch_user_activity RPC
CREATE OR REPLACE FUNCTION public.touch_user_activity(_shop_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_activity (user_id, last_seen_at, last_shop_id)
  VALUES (_uid, now(), _shop_id)
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = now(),
        last_shop_id = COALESCE(EXCLUDED.last_shop_id, public.user_activity.last_shop_id),
        updated_at = now();
  IF _shop_id IS NOT NULL THEN
    UPDATE public.shops SET last_seen_at = now() WHERE id = _shop_id;
  END IF;
END;$$;
GRANT EXECUTE ON FUNCTION public.touch_user_activity(uuid) TO authenticated;

-- 7. Review anti-fraud: unique constraints + validation trigger
DO $$ BEGIN
  ALTER TABLE public.seller_reviews ADD CONSTRAINT seller_reviews_unique_per_tx UNIQUE (reviewer_id, transaction_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.buyer_reviews ADD CONSTRAINT buyer_reviews_unique_per_tx UNIQUE (reviewer_id, transaction_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.validate_review_eligibility()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ok boolean := false; _escrow RECORD;
BEGIN
  IF NEW.reviewer_id IS NULL OR NEW.reviewer_id <> auth.uid() THEN
    RAISE EXCEPTION 'reviewer_must_match_auth_uid' USING ERRCODE = '42501';
  END IF;
  IF NEW.transaction_id IS NULL THEN
    RAISE EXCEPTION 'transaction_id_required' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO _escrow FROM public.market_escrow WHERE id = NEW.transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = '23503';
  END IF;
  IF TG_TABLE_NAME = 'seller_reviews' THEN
    -- buyer reviewing seller: reviewer must be the buyer
    IF _escrow.buyer_id <> NEW.reviewer_id THEN
      RAISE EXCEPTION 'reviewer_not_buyer_of_transaction' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'buyer_reviews' THEN
    IF _escrow.seller_id <> NEW.reviewer_id THEN
      RAISE EXCEPTION 'reviewer_not_seller_of_transaction' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF _escrow.status NOT IN ('released','delivery_confirmed','completed') THEN
    RAISE EXCEPTION 'transaction_not_completed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS seller_reviews_validate ON public.seller_reviews;
CREATE TRIGGER seller_reviews_validate BEFORE INSERT ON public.seller_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_review_eligibility();

DROP TRIGGER IF EXISTS buyer_reviews_validate ON public.buyer_reviews;
CREATE TRIGGER buyer_reviews_validate BEFORE INSERT ON public.buyer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_review_eligibility();
