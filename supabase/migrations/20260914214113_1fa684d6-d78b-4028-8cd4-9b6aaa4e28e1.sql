CREATE TABLE IF NOT EXISTS public.alert_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  alert_key text NOT NULL,
  signature text,
  read_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, alert_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_states TO authenticated;
GRANT ALL ON public.alert_states TO service_role;

ALTER TABLE public.alert_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members manage alert states"
ON public.alert_states FOR ALL
TO authenticated
USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())))
WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())));

CREATE TRIGGER update_alert_states_updated_at
BEFORE UPDATE ON public.alert_states
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();