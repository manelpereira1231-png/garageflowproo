
-- =========================================================
-- MULTI-OFICINA: eliminação segura de Oficinas Filhas
-- =========================================================

-- 1) Trigger que garante que a Oficina Mãe (a mais antiga do dono)
--    nunca pode ser eliminada, seja qual for o caminho (RLS, RPC direto,
--    service role via edge function, etc.). Super admin fica isento
--    apenas para suporte.
CREATE OR REPLACE FUNCTION public.enforce_primary_shop_undeletable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _oldest uuid;
  _is_super boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    _is_super := public.is_super_admin(auth.uid());
  END IF;
  IF _is_super THEN
    RETURN OLD;
  END IF;

  SELECT id INTO _oldest
  FROM public.shops
  WHERE user_id = OLD.user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF _oldest = OLD.id THEN
    RAISE EXCEPTION 'PRIMARY_SHOP_UNDELETABLE'
      USING ERRCODE = 'check_violation',
            HINT = 'A Oficina Mãe não pode ser eliminada.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS enforce_primary_shop_undeletable_trg ON public.shops;
CREATE TRIGGER enforce_primary_shop_undeletable_trg
BEFORE DELETE ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.enforce_primary_shop_undeletable();

-- 2) RPC para eliminar uma Oficina Filha.
--    Regras:
--    - Só o dono da conta pode eliminar (shops.user_id = auth.uid()).
--    - Nunca a Oficina Mãe.
--    - Limpa FKs que estão em NO ACTION (senão o DELETE falha).
--    - Cascata do PG trata do resto.
CREATE OR REPLACE FUNCTION public.delete_child_shop(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _oldest uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT user_id INTO _owner FROM public.shops WHERE id = _shop_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'SHOP_NOT_FOUND' USING ERRCODE='no_data_found';
  END IF;

  IF _owner <> _uid AND NOT public.is_super_admin(_uid) THEN
    RAISE EXCEPTION 'NOT_SHOP_OWNER' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT id INTO _oldest
  FROM public.shops
  WHERE user_id = _owner
  ORDER BY created_at ASC
  LIMIT 1;

  IF _oldest = _shop_id THEN
    RAISE EXCEPTION 'PRIMARY_SHOP_UNDELETABLE'
      USING ERRCODE='check_violation',
            HINT='A Oficina Mãe não pode ser eliminada.';
  END IF;

  -- Limpar FKs NO ACTION (senão bloqueiam o DELETE)
  DELETE FROM public.campaigns             WHERE shop_id = _shop_id;
  DELETE FROM public.carity_inspection_reports WHERE shop_id = _shop_id;
  DELETE FROM public.carity_inspections    WHERE shop_id = _shop_id;
  DELETE FROM public.carity_inspection_offers WHERE shop_id = _shop_id;
  DELETE FROM public.carity_listings       WHERE shop_id = _shop_id;
  DELETE FROM public.carity_transactions   WHERE shop_id = _shop_id;
  DELETE FROM public.loyalty_transactions  WHERE shop_id = _shop_id;
  DELETE FROM public.loyalty_points        WHERE shop_id = _shop_id;
  DELETE FROM public.parts_orders          WHERE shop_id = _shop_id;
  DELETE FROM public.partner_commissions   WHERE shop_id = _shop_id;
  DELETE FROM public.partner_invites       WHERE shop_id = _shop_id;
  DELETE FROM public.supplier_invites      WHERE shop_id = _shop_id;

  -- Remove associação exclusiva de utilizadores a esta oficina.
  -- shop_users cai automaticamente por CASCADE quando eliminarmos a shop,
  -- mas fazemos explícito para clareza operacional.
  DELETE FROM public.shop_users WHERE shop_id = _shop_id;

  -- DELETE final. O resto é tratado por ON DELETE CASCADE / SET NULL.
  DELETE FROM public.shops WHERE id = _shop_id;

  RETURN jsonb_build_object('success', true, 'shop_id', _shop_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_child_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_child_shop(uuid) TO authenticated;

-- 3) RPC de transferência de utilizador entre oficinas do mesmo grupo.
--    Só o dono pode invocar, e ambas as oficinas têm de pertencer-lhe.
CREATE OR REPLACE FUNCTION public.transfer_shop_user(
  _user_id uuid,
  _from_shop_id uuid,
  _to_shop_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _from_owner uuid;
  _to_owner uuid;
  _role text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT user_id INTO _from_owner FROM public.shops WHERE id = _from_shop_id;
  SELECT user_id INTO _to_owner   FROM public.shops WHERE id = _to_shop_id;

  IF _from_owner IS NULL OR _to_owner IS NULL THEN
    RAISE EXCEPTION 'SHOP_NOT_FOUND' USING ERRCODE='no_data_found';
  END IF;

  IF _from_owner <> _uid OR _to_owner <> _uid THEN
    RAISE EXCEPTION 'NOT_GROUP_OWNER' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT role INTO _role FROM public.shop_users
   WHERE user_id = _user_id AND shop_id = _from_shop_id
   LIMIT 1;

  IF _role IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_IN_SOURCE_SHOP' USING ERRCODE='no_data_found';
  END IF;

  -- Move a associação. Preserva role e histórico via user_id inalterado.
  UPDATE public.shop_users
     SET shop_id = _to_shop_id
   WHERE user_id = _user_id AND shop_id = _from_shop_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_shop_user(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_shop_user(uuid, uuid, uuid) TO authenticated;
