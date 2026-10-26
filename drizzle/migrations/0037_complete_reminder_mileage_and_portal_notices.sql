ALTER TABLE public.service_reminders ADD COLUMN IF NOT EXISTS km_notified boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.validate_service_reminder() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.vehicles v JOIN public.clients c ON c.id=v.client_id WHERE v.id=NEW.vehicle_id AND v.shop_id=NEW.shop_id AND c.shop_id=NEW.shop_id AND c.id=NEW.client_id AND v.deleted_at IS NULL AND c.deleted_at IS NULL) THEN RAISE EXCEPTION 'Invalid reminder vehicle/client/shop'; END IF;
 IF NEW.work_order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.work_orders w WHERE w.id=NEW.work_order_id AND w.shop_id=NEW.shop_id AND w.vehicle_id=NEW.vehicle_id AND w.client_id=NEW.client_id) THEN RAISE EXCEPTION 'Invalid reminder work order'; END IF;
 IF NEW.next_service_km IS NOT NULL AND (NEW.next_service_km<0 OR NEW.next_service_km>600000) THEN RAISE EXCEPTION 'Invalid reminder mileage'; END IF;
 IF TG_OP='UPDATE' AND (NEW.next_service_date IS DISTINCT FROM OLD.next_service_date OR NEW.next_service_km IS DISTINCT FROM OLD.next_service_km OR NEW.status IS DISTINCT FROM OLD.status OR NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR NEW.shop_id IS DISTINCT FROM OLD.shop_id OR NEW.service_type IS DISTINCT FROM OLD.service_type) THEN
  NEW.reminder_days_sent := '{}'; NEW.notified_at := NULL; NEW.km_notified := false;
  UPDATE public.notifications SET archived_at=now(),read=true WHERE shop_id=OLD.shop_id AND data->>'reminder_id'=OLD.id::text AND archived_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.process_service_reminders() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; d integer; n integer:=0; title_text text; body_text text;
BEGIN
 FOR r IN SELECT sr.*,tz.name tz,s.country_code,coalesce(nullif(c.company,''),c.name) client_name,v.make,v.model,v.plate,v.mileage
 FROM public.service_reminders sr JOIN public.shops s ON s.id=sr.shop_id
 JOIN pg_timezone_names tz ON tz.name=coalesce(nullif(s.timezone,''),CASE WHEN s.country_code='BR' THEN 'America/Sao_Paulo' ELSE 'Europe/Lisbon' END)
 JOIN public.vehicles v ON v.id=sr.vehicle_id AND v.shop_id=sr.shop_id AND v.client_id=sr.client_id JOIN public.clients c ON c.id=sr.client_id AND c.shop_id=sr.shop_id
 WHERE sr.status='pending' AND c.deleted_at IS NULL AND v.deleted_at IS NULL
 AND ((sr.next_service_date-(now() AT TIME ZONE tz.name)::date IN (14,7,1)) OR (sr.next_service_km IS NOT NULL AND v.mileage>=sr.next_service_km AND NOT sr.km_notified))
 FOR UPDATE OF sr SKIP LOCKED
 LOOP
  d:=r.next_service_date-(now() AT TIME ZONE r.tz)::date;
  body_text:=r.client_name || ' · ' || concat_ws(' ',r.make,r.model) || ' (' || r.plate || ')' || CASE WHEN r.next_service_date IS NOT NULL THEN ' · '||to_char(r.next_service_date,'DD/MM/YYYY') ELSE '' END || CASE WHEN r.next_service_km IS NOT NULL THEN ' · '||r.next_service_km||' km' ELSE '' END;
  IF d IN (14,7,1) AND NOT d=ANY(r.reminder_days_sent) THEN
   title_text:=CASE WHEN r.country_code='BR' THEN 'Lembrete de revisão' ELSE 'Próxima revisão' END || ' · ' || r.plate || ' · ' || d || CASE WHEN d=1 THEN ' dia' ELSE ' dias' END;
   INSERT INTO public.notifications(shop_id,type,title,message,link,data) VALUES(r.shop_id,'info',title_text,body_text,'/vehicles?search='||r.plate,jsonb_build_object('event','service_reminder','reminder_id',r.id,'vehicle_id',r.vehicle_id,'client_id',r.client_id,'days_before',d,'next_service_date',r.next_service_date));
   UPDATE public.service_reminders SET reminder_days_sent=array_append(reminder_days_sent,d),notified_at=now() WHERE id=r.id;
   n:=n+1;
  END IF;
  IF r.next_service_km IS NOT NULL AND r.mileage>=r.next_service_km AND NOT r.km_notified THEN
   INSERT INTO public.notifications(shop_id,type,title,message,link,data) VALUES(r.shop_id,'info','Revisão por quilometragem · '||r.plate,body_text||' · '||r.mileage||' km registados','/vehicles?search='||r.plate,jsonb_build_object('event','service_reminder','reminder_id',r.id,'vehicle_id',r.vehicle_id,'client_id',r.client_id,'milestone','km','next_service_km',r.next_service_km));
   UPDATE public.service_reminders SET km_notified=true,notified_at=now() WHERE id=r.id;
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
 SELECT cl.id,cl.shop_id,coalesce(nullif(s.timezone,''),CASE WHEN s.country_code='BR' THEN 'America/Sao_Paulo' ELSE 'Europe/Lisbon' END) tz INTO c FROM public.clients cl JOIN public.shops s ON s.id=cl.shop_id WHERE cl.portal_token=tok AND cl.deleted_at IS NULL LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'vehicle_id',r.vehicle_id,'service_type',r.service_type,'next_service_date',r.next_service_date,'next_service_km',r.next_service_km,'reminder_days_sent',r.reminder_days_sent,'km_notified',r.km_notified,'local_date',(now() AT TIME ZONE c.tz)::date) ORDER BY r.next_service_date NULLS LAST),'[]'::jsonb) INTO result
 FROM public.service_reminders r JOIN public.vehicles v ON v.id=r.vehicle_id AND v.shop_id=c.shop_id AND v.client_id=c.id AND v.deleted_at IS NULL
 WHERE r.shop_id=c.shop_id AND r.client_id=c.id AND r.status='pending';
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_client_portal_reminders(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_portal_reminders(text) TO anon,authenticated,service_role;