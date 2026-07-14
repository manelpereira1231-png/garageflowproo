-- Corrige ambiguidade "column reference shop_id is ambiguous" na aceitação de convites de equipa.
-- Causa: parâmetros OUT da função com o mesmo nome de colunas usadas em INSERT/ON CONFLICT.
-- Solução: usar plpgsql.variable_conflict = use_column para dar sempre prioridade às colunas
-- dentro do corpo, e qualificar o RETURN QUERY com os valores da variável de convite.

CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token uuid)
RETURNS TABLE(shop_id uuid, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_inv record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_inv FROM public.team_invitations
   WHERE token = _token
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation_already_accepted';
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation_revoked';
  END IF;

  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'invitation_expired';
  END IF;

  IF lower(v_inv.email) <> v_email THEN
    RAISE EXCEPTION 'invitation_email_mismatch';
  END IF;

  -- Associa à oficina (idempotente)
  INSERT INTO public.shop_users(shop_id, user_id, role)
  VALUES (v_inv.shop_id, v_uid, v_inv.role)
  ON CONFLICT (shop_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Cria/actualiza perfil se houver nome/telefone
  IF v_inv.name IS NOT NULL OR v_inv.phone IS NOT NULL THEN
    INSERT INTO public.shop_user_profiles(shop_user_id, full_name, phone)
    SELECT su.id, v_inv.name, v_inv.phone
      FROM public.shop_users su
     WHERE su.shop_id = v_inv.shop_id AND su.user_id = v_uid
    ON CONFLICT (shop_user_id) DO UPDATE
      SET full_name = COALESCE(EXCLUDED.full_name, shop_user_profiles.full_name),
          phone = COALESCE(EXCLUDED.phone, shop_user_profiles.phone);
  END IF;

  UPDATE public.team_invitations
     SET accepted_at = now(), accepted_by = v_uid
   WHERE id = v_inv.id;

  RETURN QUERY SELECT v_inv.shop_id, v_inv.role;
END;
$function$;