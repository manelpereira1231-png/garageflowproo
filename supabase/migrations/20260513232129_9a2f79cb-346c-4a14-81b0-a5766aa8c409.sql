
-- 1. Trust events table (immutable cross-shop log)
CREATE TABLE IF NOT EXISTS public.vehicle_trust_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vin text,
  plate text,
  vehicle_id uuid,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'service', -- service | inspection | oil_change | diagnosis | market_inspection
  event_date timestamptz NOT NULL DEFAULT now(),
  km_reported integer,
  source text NOT NULL DEFAULT 'erp_workshop', -- erp_workshop | market_inspection | manual
  reference_type text,
  reference_id uuid,
  verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vte_vin ON public.vehicle_trust_events (upper(vin)) WHERE vin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vte_plate ON public.vehicle_trust_events (upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g'))) WHERE plate IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vte_vehicle ON public.vehicle_trust_events (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vte_date ON public.vehicle_trust_events (event_date DESC);

ALTER TABLE public.vehicle_trust_events ENABLE ROW LEVEL SECURITY;

-- Shop members can view their own events (transparency); inserts only via triggers
DROP POLICY IF EXISTS "Shop members view own trust events" ON public.vehicle_trust_events;
CREATE POLICY "Shop members view own trust events" ON public.vehicle_trust_events
  FOR SELECT TO authenticated
  USING (shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid()));

-- Block direct inserts/updates/deletes from clients (immutability)
DROP POLICY IF EXISTS "No direct mutations on trust events" ON public.vehicle_trust_events;
CREATE POLICY "No direct mutations on trust events" ON public.vehicle_trust_events
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- 2. Trigger: log on work_order completion
CREATE OR REPLACE FUNCTION public.log_vehicle_trust_from_work_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vin text;
  v_plate text;
  v_km integer;
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT vin, plate INTO v_vin, v_plate FROM public.vehicles WHERE id = NEW.vehicle_id;
    -- Use entry_mileage as the verified km at the time of the service
    v_km := NULLIF(NEW.entry_mileage, 0);
    INSERT INTO public.vehicle_trust_events
      (vin, plate, vehicle_id, shop_id, event_type, event_date, km_reported, source, reference_type, reference_id)
    VALUES
      (v_vin, v_plate, NEW.vehicle_id, NEW.shop_id, 'service', COALESCE(NEW.completed_at, now()), v_km, 'erp_workshop', 'work_order', NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_trust_work_order ON public.work_orders;
CREATE TRIGGER trg_log_trust_work_order
AFTER INSERT OR UPDATE OF status ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.log_vehicle_trust_from_work_order();

-- 3. Trigger: log on Market inspection report seal
CREATE OR REPLACE FUNCTION public.log_vehicle_trust_from_inspection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l RECORD;
BEGIN
  IF NEW.is_locked = true AND (OLD IS NULL OR OLD.is_locked = false) THEN
    SELECT vin, plate INTO l FROM public.carity_listings WHERE id = NEW.listing_id;
    INSERT INTO public.vehicle_trust_events
      (vin, plate, shop_id, event_type, event_date, km_reported, source, reference_type, reference_id)
    VALUES
      (l.vin, l.plate, NEW.shop_id, 'market_inspection', COALESCE(NEW.locked_at, now()),
       NEW.mileage_at_inspection, 'market_inspection', 'inspection_report', NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_trust_inspection ON public.carity_inspection_reports;
CREATE TRIGGER trg_log_trust_inspection
AFTER INSERT OR UPDATE OF is_locked ON public.carity_inspection_reports
FOR EACH ROW EXECUTE FUNCTION public.log_vehicle_trust_from_inspection();

-- 4. Public RPC: trust check by VIN/plate
CREATE OR REPLACE FUNCTION public.market_vehicle_trust_check(
  _vin text DEFAULT NULL,
  _plate text DEFAULT NULL,
  _km_listing integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _vin_n text := NULLIF(upper(trim(coalesce(_vin, ''))), '');
  _plate_n text := NULLIF(upper(regexp_replace(coalesce(_plate, ''), '[^A-Za-z0-9]', '', 'g')), '');
  _visits int := 0;
  _shops int := 0;
  _last_km int;
  _last_date timestamptz;
  _last_shop uuid;
  _has_inspection boolean := false;
  _trust_level text;
  _km_flag boolean := false;
  _km_diff int;
  _timeline jsonb;
BEGIN
  IF _vin_n IS NULL AND _plate_n IS NULL THEN
    RETURN jsonb_build_object('trust_level', 'none', 'visits', 0);
  END IF;

  WITH events AS (
    SELECT *
    FROM public.vehicle_trust_events e
    WHERE (_vin_n IS NOT NULL AND upper(e.vin) = _vin_n)
       OR (_plate_n IS NOT NULL AND upper(regexp_replace(e.plate, '[^A-Za-z0-9]', '', 'g')) = _plate_n)
  )
  SELECT
    count(*),
    count(DISTINCT shop_id),
    bool_or(event_type = 'market_inspection' OR event_type = 'inspection')
  INTO _visits, _shops, _has_inspection
  FROM events;

  SELECT km_reported, event_date, shop_id
    INTO _last_km, _last_date, _last_shop
  FROM public.vehicle_trust_events
  WHERE ((_vin_n IS NOT NULL AND upper(vin) = _vin_n)
      OR (_plate_n IS NOT NULL AND upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g')) = _plate_n))
    AND km_reported IS NOT NULL AND km_reported > 0
  ORDER BY event_date DESC
  LIMIT 1;

  -- KM tampering detection
  IF _last_km IS NOT NULL AND _km_listing IS NOT NULL AND _km_listing > 0 THEN
    _km_diff := _last_km - _km_listing;
    IF _km_diff >= 1000 THEN
      _km_flag := true;
    END IF;
  END IF;

  -- Trust level
  IF _has_inspection THEN
    _trust_level := 'high';
  ELSIF _visits >= 3 THEN
    _trust_level := 'verified';
  ELSIF _visits >= 1 THEN
    _trust_level := 'partial';
  ELSE
    _trust_level := 'none';
  END IF;

  IF _km_flag THEN
    _trust_level := 'flagged';
  END IF;

  -- Timeline (last 10 events)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'date', event_date,
      'km', km_reported,
      'type', event_type,
      'source', source
    ) ORDER BY event_date DESC), '[]'::jsonb)
  INTO _timeline
  FROM (
    SELECT event_date, km_reported, event_type, source
    FROM public.vehicle_trust_events
    WHERE ((_vin_n IS NOT NULL AND upper(vin) = _vin_n)
        OR (_plate_n IS NOT NULL AND upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g')) = _plate_n))
    ORDER BY event_date DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'trust_level', _trust_level,
    'visits', _visits,
    'distinct_shops', _shops,
    'has_inspection', _has_inspection,
    'last_verified_km', _last_km,
    'last_verified_at', _last_date,
    'listing_km', _km_listing,
    'km_inconsistency', _km_flag,
    'km_diff', _km_diff,
    'timeline', _timeline
  );
END $$;

GRANT EXECUTE ON FUNCTION public.market_vehicle_trust_check(text, text, integer) TO anon, authenticated;

-- 5. Backfill from existing completed work_orders
INSERT INTO public.vehicle_trust_events (vin, plate, vehicle_id, shop_id, event_type, event_date, km_reported, source, reference_type, reference_id)
SELECT v.vin, v.plate, wo.vehicle_id, wo.shop_id, 'service', COALESCE(wo.completed_at, wo.created_at), NULLIF(wo.entry_mileage, 0), 'erp_workshop', 'work_order', wo.id
FROM public.work_orders wo
JOIN public.vehicles v ON v.id = wo.vehicle_id
WHERE wo.status = 'completed'
ON CONFLICT DO NOTHING;

-- 6. Backfill from sealed inspection reports
INSERT INTO public.vehicle_trust_events (vin, plate, shop_id, event_type, event_date, km_reported, source, reference_type, reference_id)
SELECT cl.vin, cl.plate, r.shop_id, 'market_inspection', COALESCE(r.locked_at, r.completed_at, now()), r.mileage_at_inspection, 'market_inspection', 'inspection_report', r.id
FROM public.carity_inspection_reports r
JOIN public.carity_listings cl ON cl.id = r.listing_id
WHERE r.is_locked = true
ON CONFLICT DO NOTHING;
