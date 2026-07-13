
-- Registo de eventos de sessão
CREATE TABLE IF NOT EXISTS public.session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('login','logout','force_logout','password_reset_required')),
  ip text,
  user_agent text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.session_events TO authenticated;
GRANT ALL ON public.session_events TO service_role;
ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_events_read_admin" ON public.session_events
FOR SELECT TO authenticated USING (
  shop_id IS NOT NULL AND (
    public.has_capability(shop_id, 'team.manage')
    OR user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
  )
);

CREATE POLICY "session_events_insert_self" ON public.session_events
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR public.is_super_admin(auth.uid())
);

CREATE INDEX IF NOT EXISTS session_events_shop_idx ON public.session_events(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS session_events_user_idx ON public.session_events(user_id, created_at DESC);

-- Forçar logout de um colaborador (apaga sessões auth)
CREATE OR REPLACE FUNCTION public.admin_force_logout(_shop_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  is_admin boolean;
  target_member boolean;
BEGIN
  -- Só owner/admin da mesma oficina
  SELECT EXISTS (
    SELECT 1 FROM public.shop_users
    WHERE shop_id = _shop_id AND user_id = auth.uid()
      AND role IN ('owner','admin')
  ) INTO is_admin;

  IF NOT is_admin AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Alvo tem de pertencer à mesma oficina
  SELECT EXISTS (
    SELECT 1 FROM public.shop_users
    WHERE shop_id = _shop_id AND user_id = _target_user_id
  ) INTO target_member;

  IF NOT target_member THEN
    RAISE EXCEPTION 'target_not_in_shop';
  END IF;

  -- Não deixar auto-logout via owner
  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_force_logout_self';
  END IF;

  -- Invalida todas as sessões desse utilizador
  DELETE FROM auth.sessions WHERE user_id = _target_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id::uuid = _target_user_id;

  -- Regista evento de auditoria
  INSERT INTO public.session_events (shop_id, user_id, event, actor_user_id)
  VALUES (_shop_id, _target_user_id, 'force_logout', auth.uid());

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_force_logout(uuid, uuid) TO authenticated;

-- Obrigar reset de password no próximo login
CREATE OR REPLACE FUNCTION public.admin_require_password_reset(_shop_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.shop_users
    WHERE shop_id = _shop_id AND user_id = auth.uid()
      AND role IN ('owner','admin')
  ) INTO is_admin;

  IF NOT is_admin AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.shop_user_profiles p
  SET must_reset_password = true, updated_at = now()
  FROM public.shop_users su
  WHERE p.shop_user_id = su.id
    AND su.shop_id = _shop_id
    AND su.user_id = _target_user_id;

  INSERT INTO public.session_events (shop_id, user_id, event, actor_user_id)
  VALUES (_shop_id, _target_user_id, 'password_reset_required', auth.uid());

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_require_password_reset(uuid, uuid) TO authenticated;
