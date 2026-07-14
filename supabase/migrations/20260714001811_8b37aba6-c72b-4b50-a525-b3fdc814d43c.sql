
-- Team invitations table
CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  phone text,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin','manager','reception','technician','commercial'])),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_invitations_shop ON public.team_invitations(shop_id);
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(lower(email));

GRANT SELECT, INSERT, UPDATE ON public.team_invitations TO authenticated;
GRANT ALL ON public.team_invitations TO service_role;

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Owner/admin da mesma oficina podem ver e revogar convites
CREATE POLICY "Owners/admins view invitations of their shop"
  ON public.team_invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_users me
      WHERE me.shop_id = team_invitations.shop_id
        AND me.user_id = auth.uid()
        AND me.role IN ('owner','admin')
    )
  );

CREATE POLICY "Owners/admins revoke invitations"
  ON public.team_invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_users me
      WHERE me.shop_id = team_invitations.shop_id
        AND me.user_id = auth.uid()
        AND me.role IN ('owner','admin')
    )
  );

-- RPC: criar convite (owner/admin da oficina)
CREATE OR REPLACE FUNCTION public.create_team_invitation(
  _shop_id uuid,
  _email text,
  _role text,
  _name text DEFAULT NULL,
  _phone text DEFAULT NULL
)
RETURNS TABLE(token uuid, invitation_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_token uuid;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT role INTO v_role FROM public.shop_users
   WHERE shop_id = _shop_id AND user_id = v_uid;

  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _role NOT IN ('admin','manager','reception','technician','commercial') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  -- Revoga convites pendentes anteriores para o mesmo email/oficina
  UPDATE public.team_invitations
     SET revoked_at = now()
   WHERE shop_id = _shop_id
     AND lower(email) = lower(_email)
     AND accepted_at IS NULL
     AND revoked_at IS NULL;

  INSERT INTO public.team_invitations(shop_id, email, name, phone, role, invited_by)
  VALUES (_shop_id, lower(trim(_email)), _name, _phone, _role, v_uid)
  RETURNING team_invitations.token, team_invitations.id INTO v_token, v_id;

  RETURN QUERY SELECT v_token, v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team_invitation(uuid, text, text, text, text) TO authenticated;

-- RPC pública: obter informação do convite pelo token (para mostrar na página)
CREATE OR REPLACE FUNCTION public.get_team_invitation_info(_token uuid)
RETURNS TABLE(
  email text,
  name text,
  phone text,
  role text,
  shop_id uuid,
  shop_name text,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ti.email, ti.name, ti.phone, ti.role, ti.shop_id, s.name,
         ti.expires_at, ti.accepted_at, ti.revoked_at,
         (ti.accepted_at IS NULL AND ti.revoked_at IS NULL AND ti.expires_at > now()) AS valid
    FROM public.team_invitations ti
    JOIN public.shops s ON s.id = ti.shop_id
   WHERE ti.token = _token
   LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_invitation_info(uuid) TO anon, authenticated;

-- RPC: aceitar convite (utilizador autenticado)
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token uuid)
RETURNS TABLE(shop_id uuid, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.accept_team_invitation(uuid) TO authenticated;
