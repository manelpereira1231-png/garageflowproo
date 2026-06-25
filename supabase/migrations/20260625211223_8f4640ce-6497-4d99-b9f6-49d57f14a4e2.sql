
CREATE POLICY "Commercial admin reads shops" ON public.shops
  FOR SELECT TO authenticated USING (public.is_commercial_admin(auth.uid()));

CREATE POLICY "Commercial admin reads subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_commercial_admin(auth.uid()));

CREATE POLICY "Commercial admin reads payments" ON public.payments
  FOR SELECT TO authenticated USING (public.is_commercial_admin(auth.uid()));

CREATE POLICY "Commercial admin reads user_activity" ON public.user_activity
  FOR SELECT TO authenticated USING (public.is_commercial_admin(auth.uid()));

ALTER TABLE public.shops REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shops';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
