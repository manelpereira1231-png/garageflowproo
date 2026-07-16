
CREATE OR REPLACE FUNCTION public.handle_new_shop_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _trial_days int;
  _inherit_plan text;
  _inherit_status text;
  _inherit_trial_end timestamptz;
  _inherit_cycle text;
  _inherit_customer text;
  _inherit_sub text;
  _inherit_period_end timestamptz;
BEGIN
  -- Tentar herdar o plano de outra oficina do mesmo dono (prioridade: garage > pro > start > free)
  SELECT s.plan, s.status, s.trial_end, s.billing_cycle,
         s.stripe_customer_id, s.stripe_subscription_id, s.current_period_end
    INTO _inherit_plan, _inherit_status, _inherit_trial_end, _inherit_cycle,
         _inherit_customer, _inherit_sub, _inherit_period_end
    FROM public.subscriptions s
    JOIN public.shops sh ON sh.id = s.shop_id
   WHERE sh.user_id = NEW.user_id
     AND sh.id <> NEW.id
   ORDER BY
     CASE lower(s.plan)
       WHEN 'garage' THEN 4
       WHEN 'pro'    THEN 3
       WHEN 'start'  THEN 2
       WHEN 'free'   THEN 1
       ELSE 0
     END DESC,
     s.created_at ASC
   LIMIT 1;

  IF _inherit_plan IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      shop_id, plan, status, trial_end, billing_cycle,
      stripe_customer_id, stripe_subscription_id, current_period_end
    )
    VALUES (
      NEW.id, _inherit_plan, _inherit_status, _inherit_trial_end, COALESCE(_inherit_cycle, 'monthly'),
      _inherit_customer, _inherit_sub, _inherit_period_end
    );
  ELSE
    SELECT COALESCE(cs.saas_trial_days, 30)
      INTO _trial_days
      FROM public.country_settings cs
     WHERE cs.code = upper(COALESCE(NEW.country_code, 'PT'))
       AND cs.active = true
     LIMIT 1;

    IF _trial_days IS NULL OR _trial_days <= 0 THEN
      _trial_days := 30;
    END IF;

    INSERT INTO public.subscriptions (shop_id, plan, status, trial_end, billing_cycle)
    VALUES (NEW.id, 'pro', 'trialing', now() + make_interval(days => _trial_days), 'monthly');
  END IF;

  INSERT INTO public.shop_users (shop_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner');

  RETURN NEW;
END;
$function$;

-- Corrigir oficinas existentes: quando o dono tem uma oficina Garage,
-- as restantes oficinas dele devem também estar em Garage.
UPDATE public.subscriptions s
   SET plan = master.plan,
       status = master.status,
       trial_end = master.trial_end,
       billing_cycle = COALESCE(master.billing_cycle, s.billing_cycle),
       stripe_customer_id = COALESCE(master.stripe_customer_id, s.stripe_customer_id),
       stripe_subscription_id = COALESCE(master.stripe_subscription_id, s.stripe_subscription_id),
       current_period_end = COALESCE(master.current_period_end, s.current_period_end),
       updated_at = now()
  FROM public.shops sh
  JOIN LATERAL (
    SELECT s2.plan, s2.status, s2.trial_end, s2.billing_cycle,
           s2.stripe_customer_id, s2.stripe_subscription_id, s2.current_period_end
      FROM public.subscriptions s2
      JOIN public.shops sh2 ON sh2.id = s2.shop_id
     WHERE sh2.user_id = sh.user_id
       AND lower(s2.plan) = 'garage'
     ORDER BY s2.created_at ASC
     LIMIT 1
  ) master ON true
 WHERE s.shop_id = sh.id
   AND lower(s.plan) <> 'garage';
