ALTER TABLE public.alert_states REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_states;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;