CREATE OR REPLACE FUNCTION public.process_service_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
   INSERT INTO public.notifications(shop_id,type,title,message,link,data) VALUES(r.shop_id,'info',title_text,body_text,'/vehicles?passport='||r.vehicle_id,jsonb_build_object('event','service_reminder','reminder_id',r.id,'vehicle_id',r.vehicle_id,'client_id',r.client_id,'days_before',d,'next_service_date',r.next_service_date));
   UPDATE public.service_reminders SET reminder_days_sent=array_append(reminder_days_sent,d),notified_at=now() WHERE id=r.id;
   n:=n+1;
  END IF;
  IF r.next_service_km IS NOT NULL AND r.mileage>=r.next_service_km AND NOT r.km_notified THEN
   INSERT INTO public.notifications(shop_id,type,title,message,link,data) VALUES(r.shop_id,'info','Revisão por quilometragem · '||r.plate,body_text||' · '||r.mileage||' km registados','/vehicles?passport='||r.vehicle_id,jsonb_build_object('event','service_reminder','reminder_id',r.id,'vehicle_id',r.vehicle_id,'client_id',r.client_id,'milestone','km','next_service_km',r.next_service_km));
   UPDATE public.service_reminders SET km_notified=true,notified_at=now() WHERE id=r.id;
   n:=n+1;
  END IF;
 END LOOP;
 RETURN n;
END
$function$;