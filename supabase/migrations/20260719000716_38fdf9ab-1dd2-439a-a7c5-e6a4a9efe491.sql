CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Non-ERP accounts do not receive an ERP workshop.
  IF COALESCE(NEW.raw_user_meta_data->>'account_type', 'garage') IN ('particular','affiliate')
     OR COALESCE(NEW.raw_user_meta_data->>'carity_user', 'false') = 'true'
     OR COALESCE(NEW.raw_user_meta_data->>'is_affiliate', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  -- A workshop is a child ONLY when created by another workshop through the
  -- official child-shop invite flow. In that case the edge function creates the
  -- child shop explicitly with group_owner_id = mother owner id.
  IF COALESCE(NEW.raw_user_meta_data->>'source', '') = 'child_shop_invite'
     OR COALESCE(NEW.raw_user_meta_data->>'account_type', '') = 'garage_child'
     OR COALESCE(NEW.raw_user_meta_data->>'skip_shop_creation', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  -- Every normal ERP signup is a mother/independent workshop. The group_owner_id
  -- trigger defaults to this same user_id, so no guessing is involved.
  INSERT INTO public.shops (user_id, name, email, country, nif)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'shop_country', 'Portugal'),
    COALESCE(NEW.raw_user_meta_data->>'shop_nif', '')
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;