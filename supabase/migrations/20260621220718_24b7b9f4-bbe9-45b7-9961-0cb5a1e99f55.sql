
CREATE OR REPLACE FUNCTION public.enroll_shop_in_market(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shop record;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id, user_id, name, phone, address, is_carity_partner, carity_active
    INTO _shop
  FROM public.shops
  WHERE id = _shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'shop_not_found';
  END IF;

  -- Owner or team member of the shop may enroll
  IF _shop.user_id <> _uid
     AND NOT public.user_is_shop_member(_uid, _shop_id)
     AND NOT public.is_super_admin(_uid) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF coalesce(btrim(_shop.name), '') = '' THEN
    RAISE EXCEPTION 'missing_name';
  END IF;
  IF coalesce(btrim(_shop.phone), '') = '' THEN
    RAISE EXCEPTION 'missing_phone';
  END IF;
  IF coalesce(btrim(_shop.address), '') = '' THEN
    RAISE EXCEPTION 'missing_address';
  END IF;

  UPDATE public.shops
     SET is_carity_partner = true,
         carity_active = true
   WHERE id = _shop_id;

  -- Ensure a wallet exists so payouts/credits work immediately
  INSERT INTO public.shop_wallets (shop_id, balance, total_earned, total_paid, status)
  VALUES (_shop_id, 0, 0, 0, 'active')
  ON CONFLICT (shop_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'shop_id', _shop_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.enroll_shop_in_market(uuid) TO authenticated;

-- shop_wallets uniqueness on shop_id (required by ON CONFLICT above)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='shop_wallets_shop_id_key'
  ) THEN
    CREATE UNIQUE INDEX shop_wallets_shop_id_key ON public.shop_wallets(shop_id);
  END IF;
END $$;
