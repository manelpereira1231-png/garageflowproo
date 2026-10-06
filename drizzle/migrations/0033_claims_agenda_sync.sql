ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS claim_id uuid REFERENCES public.claims(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS appointments_claim_auto_kind_uniq ON public.appointments (claim_id, auto_kind) WHERE claim_id IS NOT NULL AND auto_kind IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_claim_agenda_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c record; _v record; _q record; _k text; _d date; _t time; _label text; _notes text; _st text;
BEGIN
  IF NEW.status IN ('cancelled','canceled') THEN
    DELETE FROM appointments WHERE claim_id = NEW.id AND auto_kind IS NOT NULL;
    RETURN NEW;
  END IF;
  SELECT name, company, phone, email INTO _c FROM clients WHERE id = NEW.client_id;
  SELECT make, model, plate INTO _v FROM vehicles WHERE id = NEW.vehicle_id;
  SELECT reception_date, delivery_date, status INTO _q FROM quotes WHERE id = NEW.quote_id;
  _notes := 'Sinistro ' || COALESCE(NEW.claim_number,'') ||
            CASE WHEN NEW.process_number IS NOT NULL AND NEW.process_number <> '' THEN ' (proc. ' || NEW.process_number || ')' ELSE '' END ||
            ' — ' || trim(COALESCE(_v.make,'') || ' ' || COALESCE(_v.model,'')) || ' — ' || COALESCE(_v.plate,'');
  FOREACH _k IN ARRAY ARRAY['claim_in','claim_out'] LOOP
    IF _k = 'claim_in' THEN
      _d := NEW.vehicle_in_date; _t := '09:00'; _label := 'Receber Viatura (Sinistro)';
      _st := 'completed';
      -- evitar duplicado se o orçamento aprovado já marca a receção
      IF _q.reception_date IS NOT NULL AND _q.status IN ('approved','converted') THEN _d := NULL; END IF;
    ELSE
      _d := NEW.promised_date; _t := '17:00'; _label := 'Entregar Viatura (Sinistro)';
      _st := CASE WHEN NEW.vehicle_out_date IS NOT NULL THEN 'completed' ELSE 'scheduled' END;
      IF _q.delivery_date IS NOT NULL AND _q.status IN ('approved','converted') THEN _d := NULL; END IF;
    END IF;
    IF _k = 'claim_in' AND _d IS NOT NULL AND _d >= current_date THEN _st := 'scheduled'; END IF;
    IF _d IS NULL THEN
      DELETE FROM appointments WHERE claim_id = NEW.id AND auto_kind = _k;
    ELSE
      INSERT INTO appointments (shop_id, client_id, vehicle_id, service_type, date, time, duration_minutes,
        status, notes, client_name, client_phone, client_email, source, claim_id, auto_kind)
      VALUES (NEW.shop_id, NEW.client_id, NEW.vehicle_id, _label, _d, _t, 30, _st, _notes,
        COALESCE(NULLIF(_c.company,''), _c.name), _c.phone, _c.email, 'claim', NEW.id, _k)
      ON CONFLICT (claim_id, auto_kind) WHERE claim_id IS NOT NULL AND auto_kind IS NOT NULL
      DO UPDATE SET date = EXCLUDED.date, client_id = EXCLUDED.client_id, vehicle_id = EXCLUDED.vehicle_id,
        notes = EXCLUDED.notes, client_name = EXCLUDED.client_name, client_phone = EXCLUDED.client_phone,
        client_email = EXCLUDED.client_email,
        status = CASE WHEN EXCLUDED.status = 'completed' THEN 'completed'
                      WHEN appointments.status = 'completed' AND _k = 'claim_out' THEN 'scheduled'
                      ELSE appointments.status END;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS claims_sync_agenda_trg ON public.claims;
CREATE TRIGGER claims_sync_agenda_trg AFTER INSERT OR UPDATE OF vehicle_in_date, promised_date, vehicle_out_date, status, client_id, vehicle_id, quote_id, process_number ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.sync_claim_agenda_events();

CREATE OR REPLACE FUNCTION public.sync_appointment_to_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.claim_id IS NULL OR NEW.auto_kind IS NULL THEN RETURN NEW; END IF;
  IF NEW.date IS NOT DISTINCT FROM OLD.date THEN RETURN NEW; END IF;
  IF NEW.auto_kind = 'claim_in' THEN
    UPDATE claims SET vehicle_in_date = NEW.date WHERE id = NEW.claim_id AND vehicle_in_date IS DISTINCT FROM NEW.date;
  ELSIF NEW.auto_kind = 'claim_out' THEN
    UPDATE claims SET promised_date = NEW.date WHERE id = NEW.claim_id AND promised_date IS DISTINCT FROM NEW.date;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS appointments_sync_to_claim_trg ON public.appointments;
CREATE TRIGGER appointments_sync_to_claim_trg AFTER UPDATE OF date ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_to_claim();

-- preencher marcações para sinistros existentes com datas
UPDATE public.claims SET vehicle_in_date = vehicle_in_date WHERE vehicle_in_date IS NOT NULL OR promised_date IS NOT NULL;