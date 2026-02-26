-- Enable realtime for subscriptions table so frontend gets instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;