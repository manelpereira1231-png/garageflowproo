-- Run with a privileged database test session. Always roll back fixtures.
-- No emails, push messages, or writes to existing client/vehicle records.
BEGIN;
DO $$
DECLARE
 shop uuid := '2b6b0fe8-6187-4ff5-b5f5-ca4122680c00';
 client uuid := gen_random_uuid(); vehicle uuid := gen_random_uuid();
 token uuid := gen_random_uuid(); local_day date; milestone integer;
 notices integer;
BEGIN
 SELECT (now() AT TIME ZONE timezone)::date INTO local_day FROM public.shops WHERE id=shop;
 IF local_day IS NULL THEN RAISE EXCEPTION 'Isolated test shop unavailable'; END IF;
 INSERT INTO public.clients(id,shop_id,name,portal_token) VALUES(client,shop,'VALIDACAO TEMPORARIA REVISOES',token);
 INSERT INTO public.vehicles(id,shop_id,client_id,make,model,plate,mileage)
 VALUES(vehicle,shop,client,'Teste','Revisoes','TEST-'||left(vehicle::text,8),120000);
 FOREACH milestone IN ARRAY ARRAY[14,7,1,13,-1] LOOP
  INSERT INTO public.service_reminders(shop_id,client_id,vehicle_id,service_type,next_service_date)
  VALUES(shop,client,vehicle,'test-'||milestone,local_day+milestone);
 END LOOP;
 INSERT INTO public.service_reminders(shop_id,client_id,vehicle_id,service_type,next_service_km)
 VALUES(shop,client,vehicle,'test-km',120000),(shop,client,vehicle,'test-km-future',120001);
 PERFORM public.process_service_reminders();
 SELECT count(*) INTO notices FROM public.notifications WHERE data->>'client_id'=client::text AND archived_at IS NULL;
 IF notices<>4 THEN RAISE EXCEPTION 'Expected three date notices and one mileage notice, got %',notices; END IF;
 FOREACH milestone IN ARRAY ARRAY[14,7,1] LOOP
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE data->>'client_id'=client::text AND data->>'days_before'=milestone::text)
  THEN RAISE EXCEPTION 'Missing milestone %',milestone; END IF;
 END LOOP;
 PERFORM public.process_service_reminders();
 SELECT count(*) INTO notices FROM public.notifications WHERE data->>'client_id'=client::text AND archived_at IS NULL;
 IF notices<>4 THEN RAISE EXCEPTION 'Duplicate notices'; END IF;
 IF jsonb_array_length(public.get_client_portal_reminders(token::text))<>7 THEN RAISE EXCEPTION 'Portal reminder mismatch'; END IF;
 IF public.get_client_portal_reminders(gen_random_uuid()::text) IS NOT NULL THEN RAISE EXCEPTION 'Invalid portal token accepted'; END IF;
 UPDATE public.service_reminders SET status='cancelled' WHERE client_id=client AND service_type='test-km';
 IF EXISTS (SELECT 1 FROM public.notifications WHERE data->>'client_id'=client::text AND data->>'milestone'='km' AND archived_at IS NULL)
 THEN RAISE EXCEPTION 'Cancelled mileage notice remains active'; END IF;
END $$;
ROLLBACK;