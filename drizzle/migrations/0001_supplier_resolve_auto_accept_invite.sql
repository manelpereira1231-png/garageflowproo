CREATE OR REPLACE FUNCTION public.gsn_resolve_my_supplier()
RETURNS TABLE(id uuid, state text, rejection_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _row public.gsn_suppliers%ROWTYPE;
  _is_shop boolean;
  _inv public.gsn_supplier_invites%ROWTYPE;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  SELECT s.* INTO _row
  FROM public.gsn_suppliers s
  WHERE s.owner_user_id = _uid AND s.deleted_at IS NULL
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _row.id IS NULL THEN
    SELECT u.email INTO _email FROM auth.users u WHERE u.id = _uid;
    SELECT EXISTS (SELECT 1 FROM public.shop_users su WHERE su.user_id = _uid) INTO _is_shop;

    IF _email IS NOT NULL AND NOT _is_shop THEN
      -- 1) registo criado pelo Admin ainda sem conta ligada
      SELECT s.* INTO _row
      FROM public.gsn_suppliers s
      WHERE s.deleted_at IS NULL
        AND s.owner_user_id IS NULL
        AND lower(s.email) = lower(_email)
      ORDER BY s.created_at DESC
      LIMIT 1;

      IF _row.id IS NOT NULL THEN
        UPDATE public.gsn_suppliers
        SET owner_user_id = _uid, updated_at = now()
        WHERE public.gsn_suppliers.id = _row.id;
        _row.owner_user_id := _uid;
      ELSE
        -- 2) convite por aceitar (registo interrompido/confirmação de email):
        --    completa automaticamente para nunca cair no ERP da oficina
        SELECT i.* INTO _inv
        FROM public.gsn_supplier_invites i
        WHERE lower(i.email) = lower(_email)
          AND i.used_at IS NULL
          AND i.expires_at > now()
        ORDER BY i.created_at DESC
        LIMIT 1;

        IF _inv.id IS NOT NULL THEN
          INSERT INTO public.gsn_suppliers (
            owner_user_id, company_name, trade_name, vat_number, email, phone, website,
            country, district, city, commission_percentage, subscription_plan,
            state, application_source, approved, active, invited_at, invited_by
          ) VALUES (
            _uid, _inv.company_name, _inv.trade_name, _inv.vat_number, _inv.email, _inv.phone, _inv.website,
            COALESCE(_inv.country,'PT'), _inv.district, _inv.city, COALESCE(_inv.commission_percentage,5), _inv.plan,
            'pending_approval', 'invite', false, true, _inv.created_at, _inv.invited_by
          ) RETURNING gsn_suppliers.id INTO _new_id;

          UPDATE public.gsn_supplier_invites
          SET used_at = now(), used_by = _uid
          WHERE public.gsn_supplier_invites.id = _inv.id;

          SELECT s.* INTO _row FROM public.gsn_suppliers s WHERE s.id = _new_id;
        END IF;
      END IF;
    END IF;
  END IF;

  IF _row.id IS NULL THEN RETURN; END IF;

  id := _row.id;
  state := _row.state::text;
  rejection_reason := _row.rejection_reason;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsn_resolve_my_supplier() TO authenticated;