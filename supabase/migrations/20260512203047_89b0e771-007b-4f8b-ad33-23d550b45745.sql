
-- Add auditable fields to inspection reports
ALTER TABLE public.carity_inspection_reports
  ADD COLUMN IF NOT EXISTS brakes_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS suspension_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS inspection_lat numeric,
  ADD COLUMN IF NOT EXISTS inspection_lng numeric,
  ADD COLUMN IF NOT EXISTS inspection_city text,
  ADD COLUMN IF NOT EXISTS inspection_country text,
  ADD COLUMN IF NOT EXISTS mileage_at_inspection integer,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_token text UNIQUE;

-- Backfill verification tokens for existing reports
UPDATE public.carity_inspection_reports
SET verification_token = encode(gen_random_bytes(16), 'hex')
WHERE verification_token IS NULL;

-- Trigger to auto-generate verification_token on insert
CREATE OR REPLACE FUNCTION public.set_inspection_verification_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.verification_token IS NULL THEN
    NEW.verification_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_verification_token ON public.carity_inspection_reports;
CREATE TRIGGER trg_set_verification_token
BEFORE INSERT ON public.carity_inspection_reports
FOR EACH ROW EXECUTE FUNCTION public.set_inspection_verification_token();

-- Update generate_report_hash to include the new auditable fields
CREATE OR REPLACE FUNCTION public.generate_report_hash(_report_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    || '|' || _report.brakes_photos::text
    || '|' || _report.suspension_photos::text
    || '|' || COALESCE(_report.technician_name, '')
    || '|' || COALESCE(_report.completed_at::text, '')
    || '|' || COALESCE(_report.started_at::text, '')
    || '|' || COALESCE(_report.inspection_lat::text, '')
    || '|' || COALESCE(_report.inspection_lng::text, '')
    || '|' || COALESCE(_report.inspection_city, '')
    || '|' || COALESCE(_report.inspection_country, '')
    || '|' || COALESCE(_report.mileage_at_inspection::text, '');

  RETURN encode(digest(_hash_input, 'sha256'), 'hex');
END;
$function$;

-- Public verification function (returns sanitized data + integrity check)
CREATE OR REPLACE FUNCTION public.verify_inspection_certificate(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _report RECORD;
  _listing RECORD;
  _shop RECORD;
  _computed_hash text;
  _shop_inspections_count int;
BEGIN
  SELECT * INTO _report FROM carity_inspection_reports WHERE verification_token = _token AND is_locked = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Certificado não encontrado ou ainda não selado');
  END IF;

  SELECT id, make, model, year, plate, vin, mileage, status INTO _listing
    FROM carity_listings WHERE id = _report.listing_id;
  SELECT id, name, nif, address, city, country, latitude, longitude INTO _shop
    FROM shops WHERE id = _report.shop_id;

  _computed_hash := generate_report_hash(_report.id);

  SELECT count(*) INTO _shop_inspections_count
    FROM carity_inspection_reports WHERE shop_id = _report.shop_id AND is_locked = true;

  RETURN jsonb_build_object(
    'valid', true,
    'integrity_ok', (_computed_hash = _report.report_hash),
    'computed_hash', _computed_hash,
    'stored_hash', _report.report_hash,
    'report', jsonb_build_object(
      'id', _report.id,
      'ref', upper(substr(_report.id::text, 1, 8)),
      'overall_score', _report.overall_score,
      'recommendation', _report.recommendation,
      'engine_status', _report.engine_status,
      'transmission_status', _report.transmission_status,
      'brakes_status', _report.brakes_status,
      'suspension_status', _report.suspension_status,
      'steering_status', _report.steering_status,
      'tires_status', _report.tires_status,
      'electrical_status', _report.electrical_status,
      'inspector_notes', _report.inspector_notes,
      'defects', _report.defects,
      'technician_name', _report.technician_name,
      'started_at', _report.started_at,
      'completed_at', _report.completed_at,
      'locked_at', _report.locked_at,
      'inspection_lat', _report.inspection_lat,
      'inspection_lng', _report.inspection_lng,
      'inspection_city', _report.inspection_city,
      'inspection_country', _report.inspection_country,
      'mileage_at_inspection', _report.mileage_at_inspection,
      'exterior_photos', _report.exterior_photos,
      'interior_photos', _report.interior_photos,
      'engine_photos', _report.engine_photos,
      'brakes_photos', _report.brakes_photos,
      'suspension_photos', _report.suspension_photos,
      'tire_photos', _report.tire_photos,
      'damage_photos', _report.damage_photos
    ),
    'listing', to_jsonb(_listing),
    'shop', jsonb_build_object(
      'id', _shop.id,
      'name', _shop.name,
      'address', _shop.address,
      'city', _shop.city,
      'country', _shop.country,
      'total_inspections', _shop_inspections_count
    )
  );
END;
$$;
