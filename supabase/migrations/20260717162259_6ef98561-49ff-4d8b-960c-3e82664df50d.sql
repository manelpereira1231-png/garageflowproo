-- Fix crítico: o trigger `handle_new_shop_subscription` referenciava
-- `sh.owner_id` / `NEW.owner_id`, mas a tabela `public.shops` só tem
-- a coluna `user_id`. Isso produz o erro
--   "column sh.owner_id does not exist"
-- ao criar uma oficina (o trigger corre em AFTER INSERT via `on_shop_created`).
-- Recriamos a função com a coluna correta, mantendo a lógica de herança de
-- plano pela oficina primária do mesmo dono.
CREATE OR REPLACE FUNCTION public.handle_new_shop_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text; v_status text; v_customer text; v_sub text;
BEGIN
  SELECT s.plan, s.status, s.stripe_customer_id, s.stripe_subscription_id
    INTO v_plan, v_status, v_customer, v_sub
  FROM public.subscriptions s
  JOIN public.shops sh ON sh.id = s.shop_id
  JOIN public.plans p ON p.slug = s.plan
  WHERE sh.user_id = NEW.user_id
    AND sh.id <> NEW.id
    AND p.active = true
  ORDER BY p.sort_order DESC, s.created_at DESC
  LIMIT 1;

  IF v_plan IS NULL THEN
    v_plan := 'free';
    v_status := 'active';
  END IF;

  INSERT INTO public.subscriptions (shop_id, plan, status, stripe_customer_id, stripe_subscription_id)
  VALUES (NEW.id, v_plan, COALESCE(v_status, 'active'), v_customer, v_sub)
  ON CONFLICT (shop_id) DO NOTHING;

  RETURN NEW;
END
$$;