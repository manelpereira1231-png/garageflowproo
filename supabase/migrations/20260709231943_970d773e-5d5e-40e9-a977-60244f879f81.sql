
-- 1) Tabela de pedidos de adesão ao Marketplace
CREATE TABLE IF NOT EXISTS public.marketplace_activation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_activation_requests_shop_pending_uidx
  ON public.marketplace_activation_requests(shop_id) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.marketplace_activation_requests TO authenticated;
GRANT ALL ON public.marketplace_activation_requests TO service_role;

ALTER TABLE public.marketplace_activation_requests ENABLE ROW LEVEL SECURITY;

-- Dono da oficina vê os seus pedidos
CREATE POLICY "owner can view own activation requests"
ON public.marketplace_activation_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admin/commercial_admin vêem tudo
CREATE POLICY "admins can view all activation requests"
ON public.marketplace_activation_requests FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'super_admin'::app_role) OR
  public.has_role(auth.uid(), 'commercial_admin'::app_role)
);

-- Admin/commercial_admin podem actualizar
CREATE POLICY "admins can update activation requests"
ON public.marketplace_activation_requests FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'super_admin'::app_role) OR
  public.has_role(auth.uid(), 'commercial_admin'::app_role)
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_mar ON public.marketplace_activation_requests;
CREATE TRIGGER trg_touch_mar BEFORE UPDATE ON public.marketplace_activation_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 2) Reescrever RPC: agora cria pedido pendente + notifica admins (SEM conceder roles)
CREATE OR REPLACE FUNCTION public.activate_marketplace_for_shop(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop record;
  v_req_id uuid;
  v_existing_status text;
  v_admin record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = _shop_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'shop_not_found'; END IF;
  IF v_shop.user_id <> v_uid THEN RAISE EXCEPTION 'not_owner'; END IF;

  -- Se já existe um pedido pendente, devolve-o
  SELECT id, status INTO v_req_id, v_existing_status
  FROM public.marketplace_activation_requests
  WHERE shop_id = _shop_id
  ORDER BY requested_at DESC LIMIT 1;

  IF v_req_id IS NOT NULL AND v_existing_status = 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'pending', 'request_id', v_req_id);
  END IF;

  IF v_req_id IS NOT NULL AND v_existing_status = 'approved' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'approved', 'request_id', v_req_id);
  END IF;

  INSERT INTO public.marketplace_activation_requests (shop_id, user_id, status)
  VALUES (_shop_id, v_uid, 'pending')
  RETURNING id INTO v_req_id;

  -- Notifica admins e administradores comerciais
  FOR v_admin IN
    SELECT DISTINCT user_id FROM public.user_roles
    WHERE role IN ('admin'::app_role, 'super_admin'::app_role, 'commercial_admin'::app_role)
  LOOP
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        v_admin.user_id,
        'marketplace_activation_request',
        'Nova adesão ao Marketplace',
        'A oficina "' || COALESCE(v_shop.name,'(sem nome)') || '" pediu adesão ao Marketplace.',
        jsonb_build_object('shop_id', _shop_id, 'request_id', v_req_id, 'shop_name', v_shop.name)
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'status', 'pending', 'request_id', v_req_id);
END;
$$;

REVOKE ALL ON FUNCTION public.activate_marketplace_for_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_marketplace_for_shop(uuid) TO authenticated;

-- 3) RPC de revisão (aprovar/rejeitar) — só admin/commercial_admin
CREATE OR REPLACE FUNCTION public.review_marketplace_activation(_request_id uuid, _approve boolean, _notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req record;
  v_shop record;
  v_profile_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role) OR
    public.has_role(v_uid, 'super_admin'::app_role) OR
    public.has_role(v_uid, 'commercial_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_req FROM public.marketplace_activation_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reviewed', 'status', v_req.status);
  END IF;

  IF _approve THEN
    SELECT * INTO v_shop FROM public.shops WHERE id = v_req.shop_id;

    -- Cria perfil de vendedor se ainda não existe
    SELECT id INTO v_profile_id FROM public.carity_seller_profiles
      WHERE user_id = v_req.user_id LIMIT 1;

    IF v_profile_id IS NULL THEN
      INSERT INTO public.carity_seller_profiles (
        user_id, name, phone, location, address, nif, country_code, account_type
      ) VALUES (
        v_req.user_id,
        COALESCE(NULLIF(v_shop.name,''),'Oficina'),
        COALESCE(v_shop.phone,''),
        COALESCE(v_shop.address,''),
        COALESCE(v_shop.address,''),
        NULLIF(v_shop.nif,''),
        COALESCE(v_shop.country_code,'PT'),
        'particular'
      ) RETURNING id INTO v_profile_id;
    END IF;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_req.user_id, 'buyer'::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_req.user_id, 'seller'::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.shops SET is_carity_partner = true, carity_active = true
      WHERE id = v_req.shop_id AND is_carity_partner = false;

    UPDATE public.marketplace_activation_requests
      SET status='approved', reviewed_by=v_uid, reviewed_at=now(), notes=_notes
      WHERE id = _request_id;

    BEGIN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (v_req.user_id, 'marketplace_activation_approved',
        'Adesão ao Marketplace aprovada',
        'A sua oficina já pode receber inspecções e vender no Marketplace.',
        jsonb_build_object('shop_id', v_req.shop_id, 'request_id', _request_id));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    RETURN jsonb_build_object('ok', true, 'status', 'approved');
  ELSE
    UPDATE public.marketplace_activation_requests
      SET status='rejected', reviewed_by=v_uid, reviewed_at=now(), notes=_notes
      WHERE id = _request_id;

    BEGIN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (v_req.user_id, 'marketplace_activation_rejected',
        'Adesão ao Marketplace recusada',
        COALESCE(_notes,'O pedido de adesão ao Marketplace foi recusado.'),
        jsonb_build_object('shop_id', v_req.shop_id, 'request_id', _request_id));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_marketplace_activation(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_marketplace_activation(uuid, boolean, text) TO authenticated;
