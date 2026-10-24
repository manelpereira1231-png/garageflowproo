ALTER TABLE public.service_reminders ADD COLUMN IF NOT EXISTS reminder_days_sent integer[] NOT NULL DEFAULT '{}';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_reminders TO authenticated;
GRANT ALL ON public.service_reminders TO service_role;
CREATE POLICY service_reminders_authorized_access ON public.service_reminders AS PERMISSIVE FOR ALL TO authenticated USING (public.has_capability(shop_id, 'clients.view')) WITH CHECK (public.has_capability(shop_id, 'clients.edit'));

CREATE OR REPLACE FUNCTION public.validate_service_reminder() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.vehicles v JOIN public.clients c ON c.id=v.client_id WHERE v.id=NEW.vehicle_id AND v.shop_id=NEW.shop_id AND c.shop_id=NEW.shop_id AND c.id=NEW.client_id AND v.deleted_at IS NULL AND c.deleted_at IS NULL) THEN RAISE EXCEPTION 'Invalid reminder vehicle/client/shop'; END IF;
 IF NEW.work_order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.work_orders w WHERE w.id=NEW.work_order_id AND w.shop_id=NEW.shop_id AND w.vehicle_id=NEW.vehicle_id AND w.client_id=NEW.client_id) THEN RAISE EXCEPTION 'Invalid reminder work order'; END IF;
 IF NEW.next_service_km IS NOT NULL AND (NEW.next_service_km<0 OR NEW.next_service_km>600000) THEN RAISE EXCEPTION 'Invalid reminder mileage'; END IF;
 IF TG_OP='UPDATE' AND (NEW.next_service_date IS DISTINCT FROM OLD.next_service_date OR NEW.next_service_km IS DISTINCT FROM OLD.next_service_km OR NEW.status IS DISTINCT FROM OLD.status OR NEW.client_id IS DISTINCT FROM OLD.client_id) THEN
  NEW.reminder_days_sent := '{}'; NEW.notified_at := NULL;
  UPDATE public.notifications SET archived_at=now(), read=true WHERE shop_id=OLD.shop_id AND data->>'reminder_id'=OLD.id::text AND archived_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER service_reminders_validate BEFORE INSERT OR UPDATE ON public.service_reminders FOR EACH ROW EXECUTE FUNCTION public.validate_service_reminder();

CREATE OR REPLACE FUNCTION public.save_service_reminder(_shop_id uuid,_vehicle_id uuid,_client_id uuid,_work_order_id uuid,_date date,_km integer DEFAULT NULL,_service_type text DEFAULT 'revision') RETURNS public.service_reminders LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.service_reminders;
BEGIN
 IF NOT public.has_capability(_shop_id,'clients.edit') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 INSERT INTO public.service_reminders(shop_id,vehicle_id,client_id,work_order_id,next_service_date,next_service_km,service_type)
 VALUES(_shop_id,_vehicle_id,_client_id,_work_order_id,_date,_km,_service_type)
 ON CONFLICT (vehicle_id,(coalesce(service_type,''))) WHERE status='pending' AND vehicle_id IS NOT NULL
 DO UPDATE SET next_service_date=EXCLUDED.next_service_date,next_service_km=EXCLUDED.next_service_km,client_id=EXCLUDED.client_id,work_order_id=EXCLUDED.work_order_id
 RETURNING * INTO r;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.save_service_reminder(uuid,uuid,uuid,uuid,date,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_service_reminder(uuid,uuid,uuid,uuid,date,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_service_reminders() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; d integer; n integer:=0; title_text text; body_text text;
BEGIN
 FOR r IN SELECT sr.*,coalesce(nullif(s.timezone,''),CASE WHEN s.country_code='BR' THEN 'America/Sao_Paulo' ELSE 'Europe/Lisbon' END) tz,s.country_code,coalesce(nullif(c.company,''),c.name) client_name,v.make,v.model,v.plate
 FROM public.service_reminders sr JOIN public.shops s ON s.id=sr.shop_id JOIN public.vehicles v ON v.id=sr.vehicle_id AND v.shop_id=sr.shop_id AND v.client_id=sr.client_id JOIN public.clients c ON c.id=sr.client_id AND c.shop_id=sr.shop_id
 WHERE sr.status='pending' AND sr.next_service_date IS NOT NULL AND c.deleted_at IS NULL AND v.deleted_at IS NULL
 AND sr.next_service_date BETWEEN current_date-1 AND current_date+15 FOR UPDATE OF sr SKIP LOCKED
 LOOP
  d:=r.next_service_date-(now() AT TIME ZONE r.tz)::date;
  IF d IN (14,7,1) AND NOT d=ANY(r.reminder_days_sent) THEN
   title_text := CASE WHEN r.country_code='BR' THEN 'Lembrete de revisão' ELSE 'Próxima revisão' END || ' · ' || r.plate || ' · ' || d || CASE WHEN d=1 THEN ' dia' ELSE ' dias' END;
   body_text := r.client_name || ' · ' || concat_ws(' ',r.make,r.model) || ' (' || r.plate || ') · ' || to_char(r.next_service_date,'DD/MM/YYYY') || CASE WHEN r.next_service_km IS NOT NULL THEN ' · '||r.next_service_km||' km' ELSE '' END;
   INSERT INTO public.notifications(shop_id,type,title,message,link,data) VALUES(r.shop_id,'info',title_text,body_text,'/vehicles?search='||r.plate,jsonb_build_object('event','service_reminder','reminder_id',r.id,'vehicle_id',r.vehicle_id,'client_id',r.client_id,'days_before',d,'next_service_date',r.next_service_date));
   UPDATE public.service_reminders SET reminder_days_sent=array_append(reminder_days_sent,d),notified_at=now() WHERE id=r.id;
   n:=n+1;
  END IF;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.process_service_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_service_reminders() TO service_role;

CREATE OR REPLACE FUNCTION public.get_client_portal_reminders(_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; tok uuid; result jsonb;
BEGIN
 BEGIN tok:=_token::uuid; EXCEPTION WHEN others THEN RETURN NULL; END;
 SELECT id,shop_id INTO c FROM public.clients WHERE portal_token=tok AND deleted_at IS NULL LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'vehicle_id',r.vehicle_id,'service_type',r.service_type,'next_service_date',r.next_service_date,'next_service_km',r.next_service_km,'reminder_days_sent',r.reminder_days_sent) ORDER BY r.next_service_date NULLS LAST),'[]'::jsonb) INTO result
 FROM public.service_reminders r JOIN public.vehicles v ON v.id=r.vehicle_id AND v.shop_id=c.shop_id AND v.client_id=c.id AND v.deleted_at IS NULL
 WHERE r.shop_id=c.shop_id AND r.client_id=c.id AND r.status='pending';
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_client_portal_reminders(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_portal_reminders(text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.invalidate_work_order_reminders() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.status IN ('completed','delivered') AND NEW.status NOT IN ('completed','delivered') THEN
 UPDATE public.service_reminders SET status='cancelled' WHERE work_order_id=NEW.id AND shop_id=NEW.shop_id AND status='pending';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER work_order_reminder_reopen AFTER UPDATE OF status ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.invalidate_work_order_reminders();