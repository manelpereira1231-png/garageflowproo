ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS share_photos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reception_date date,
  ADD COLUMN IF NOT EXISTS reception_time time,
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS delivery_time time;

CREATE OR REPLACE FUNCTION public.quotes_photos_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.photos IS NULL THEN NEW.photos := '[]'::jsonb; END IF;
  IF jsonb_typeof(NEW.photos) <> 'array' THEN RAISE EXCEPTION 'photos must be an array'; END IF;
  IF jsonb_array_length(NEW.photos) > 7 THEN
    RAISE EXCEPTION 'Máximo de 7 fotografias por orçamento';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS quotes_photos_limit_trg ON public.quotes;
CREATE TRIGGER quotes_photos_limit_trg BEFORE INSERT OR UPDATE OF photos ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.quotes_photos_limit();

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS auto_kind text;
CREATE UNIQUE INDEX IF NOT EXISTS appointments_quote_auto_kind_uniq
  ON public.appointments (quote_id, auto_kind) WHERE quote_id IS NOT NULL AND auto_kind IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_quote_vehicle_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c record; _k text; _d date; _t time; _label text; _notes text; _v record;
BEGIN
  SELECT name, company, phone, email INTO _c FROM clients WHERE id = NEW.client_id;
  SELECT make, model, plate INTO _v FROM vehicles WHERE id = NEW.vehicle_id;
  _notes := 'Orçamento ' || COALESCE(NEW.number,'') || ' — ' ||
            trim(COALESCE(_v.make,'') || ' ' || COALESCE(_v.model,'')) || ' — ' || COALESCE(_v.plate,'');
  FOREACH _k IN ARRAY ARRAY['reception','delivery'] LOOP
    IF _k = 'reception' THEN _d := NEW.reception_date; _t := NEW.reception_time; _label := 'Receber Viatura';
    ELSE _d := NEW.delivery_date; _t := NEW.delivery_time; _label := 'Entregar Viatura'; END IF;
    IF _d IS NULL OR _t IS NULL OR NEW.status = 'cancelled' THEN
      DELETE FROM appointments WHERE quote_id = NEW.id AND auto_kind = _k;
    ELSE
      INSERT INTO appointments (shop_id, client_id, vehicle_id, service_type, date, time, duration_minutes,
        status, notes, client_name, client_phone, client_email, source, quote_id, auto_kind)
      VALUES (NEW.shop_id, NEW.client_id, NEW.vehicle_id, _label, _d, _t, 30, 'scheduled', _notes,
        COALESCE(NULLIF(_c.company,''), _c.name), _c.phone, _c.email, 'quote', NEW.id, _k)
      ON CONFLICT (quote_id, auto_kind) WHERE quote_id IS NOT NULL AND auto_kind IS NOT NULL
      DO UPDATE SET date = EXCLUDED.date, time = EXCLUDED.time, client_id = EXCLUDED.client_id,
        vehicle_id = EXCLUDED.vehicle_id, notes = EXCLUDED.notes, client_name = EXCLUDED.client_name,
        client_phone = EXCLUDED.client_phone, client_email = EXCLUDED.client_email;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS quotes_sync_vehicle_events_trg ON public.quotes;
CREATE TRIGGER quotes_sync_vehicle_events_trg
AFTER INSERT OR UPDATE OF reception_date, reception_time, delivery_date, delivery_time, status, client_id, vehicle_id ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.sync_quote_vehicle_events();

CREATE OR REPLACE FUNCTION public.get_quote_by_token(_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _q record; _c record; _v record; _s record; _qj jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  IF NOT public._public_token_throttle('quote:' || _token) THEN
    RAISE EXCEPTION 'rate_limited' USING HINT = 'Demasiados pedidos para este link.';
  END IF;
  SELECT * INTO _q FROM public.quotes
   WHERE token::text = _token AND token_revoked_at IS NULL AND status <> 'cancelled'
     AND created_at > now() - interval '365 days' LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT name, email, phone, company INTO _c FROM public.clients WHERE id = _q.client_id;
  SELECT make, model, version, plate, year, fuel, mileage INTO _v FROM public.vehicles WHERE id = _q.vehicle_id;
  SELECT name, email, phone, nif, address, logo_url, currency, language, labor_rate, vat_rate, country_code
    INTO _s FROM public.shops WHERE id = _q.shop_id;
  _qj := to_jsonb(_q) - 'photos';
  _qj := _qj || jsonb_build_object('photo_count', CASE WHEN _q.share_photos THEN jsonb_array_length(COALESCE(_q.photos,'[]'::jsonb)) ELSE 0 END);
  RETURN jsonb_build_object('quote', _qj, 'client', to_jsonb(_c), 'vehicle', to_jsonb(_v), 'shop', to_jsonb(_s));
END $function$;

CREATE POLICY "Shop members read quote photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'quote-photos' AND (storage.foldername(name))[1] IN (SELECT (public.get_user_shop_ids(auth.uid()))::text));
CREATE POLICY "Shop members upload quote photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'quote-photos' AND (storage.foldername(name))[1] IN (SELECT (public.get_user_shop_ids(auth.uid()))::text));
CREATE POLICY "Shop members delete quote photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'quote-photos' AND (storage.foldername(name))[1] IN (SELECT (public.get_user_shop_ids(auth.uid()))::text));