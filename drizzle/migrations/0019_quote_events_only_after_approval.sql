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
    IF _d IS NULL OR _t IS NULL OR NEW.status NOT IN ('approved','converted') THEN
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

-- Agenda -> orçamento: editar o evento automático atualiza a data/hora no orçamento
CREATE OR REPLACE FUNCTION public.sync_appointment_to_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.quote_id IS NULL OR NEW.auto_kind IS NULL THEN RETURN NEW; END IF;
  IF NEW.date IS NOT DISTINCT FROM OLD.date AND NEW.time IS NOT DISTINCT FROM OLD.time THEN RETURN NEW; END IF;
  IF NEW.auto_kind = 'reception' THEN
    UPDATE quotes SET reception_date = NEW.date, reception_time = NEW.time::time
     WHERE id = NEW.quote_id AND (reception_date IS DISTINCT FROM NEW.date OR reception_time IS DISTINCT FROM NEW.time::time);
  ELSIF NEW.auto_kind = 'delivery' THEN
    UPDATE quotes SET delivery_date = NEW.date, delivery_time = NEW.time::time
     WHERE id = NEW.quote_id AND (delivery_date IS DISTINCT FROM NEW.date OR delivery_time IS DISTINCT FROM NEW.time::time);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS appointments_sync_to_quote_trg ON public.appointments;
CREATE TRIGGER appointments_sync_to_quote_trg AFTER UPDATE OF date, time ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_to_quote();

-- limpar eventos de orçamentos ainda não aprovados
DELETE FROM public.appointments a USING public.quotes q
 WHERE a.quote_id = q.id AND a.auto_kind IS NOT NULL AND q.status NOT IN ('approved','converted');