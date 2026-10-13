-- 1) Convidados que confirmaram o email mas não voltaram ao link do convite
-- ficavam sem oficina. Aceita os convites válidos deste email ao entrar.
CREATE OR REPLACE FUNCTION public.accept_my_pending_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_inv record;
  n integer := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN RETURN 0; END IF;
  FOR v_inv IN
    SELECT DISTINCT ON (shop_id) * FROM public.team_invitations
     WHERE lower(email) = v_email AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
     ORDER BY shop_id, created_at DESC
  LOOP
    INSERT INTO public.shop_users(shop_id, user_id, role)
    VALUES (v_inv.shop_id, v_uid, v_inv.role)
    ON CONFLICT (shop_id, user_id) DO NOTHING;
    IF v_inv.name IS NOT NULL OR v_inv.phone IS NOT NULL THEN
      INSERT INTO public.shop_user_profiles(shop_user_id, full_name, phone)
      SELECT su.id, v_inv.name, v_inv.phone FROM public.shop_users su
       WHERE su.shop_id = v_inv.shop_id AND su.user_id = v_uid
      ON CONFLICT (shop_user_id) DO NOTHING;
    END IF;
    UPDATE public.team_invitations SET accepted_at = now(), accepted_by = v_uid
     WHERE lower(email) = v_email AND shop_id = v_inv.shop_id AND accepted_at IS NULL AND revoked_at IS NULL;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_my_pending_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_my_pending_invitations() TO authenticated;

-- 2) Ligação serviço (OS) -> marcação da Agenda, sem duplicados.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS appointments_work_order_service_uniq
  ON public.appointments(work_order_id) WHERE work_order_id IS NOT NULL AND auto_kind = 'service';