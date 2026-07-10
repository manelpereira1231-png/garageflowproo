
-- A) Notifications: adicionar colunas data (jsonb) e archived_at
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON public.notifications(user_id, type);
CREATE INDEX IF NOT EXISTS idx_notifications_archived_at ON public.notifications(archived_at);

-- B) demo_requests: coluna archived_at + trigger auto-archive on cancel
ALTER TABLE public.demo_requests
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_demo_requests_archived_at ON public.demo_requests(archived_at);

CREATE OR REPLACE FUNCTION public.tg_demo_requests_autoarchive()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelled' AND NEW.archived_at IS NULL THEN
    NEW.archived_at = now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_demo_requests_autoarchive ON public.demo_requests;
CREATE TRIGGER trg_demo_requests_autoarchive
  BEFORE INSERT OR UPDATE ON public.demo_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_demo_requests_autoarchive();

-- C) RPC de adesão ao marketplace: preencher dados completos na notificação
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
  v_owner_name text;
  v_owner_email text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = _shop_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'shop_not_found'; END IF;
  IF v_shop.user_id <> v_uid THEN RAISE EXCEPTION 'not_owner'; END IF;

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

  BEGIN
    SELECT u.email INTO v_owner_email FROM auth.users u WHERE u.id = v_uid;
  EXCEPTION WHEN OTHERS THEN v_owner_email := NULL; END;

  v_owner_name := COALESCE(v_shop.owner_name, v_owner_email);

  FOR v_admin IN
    SELECT DISTINCT user_id FROM public.user_roles
    WHERE role IN ('admin'::app_role, 'super_admin'::app_role, 'commercial_admin'::app_role)
  LOOP
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, message, link, data)
      VALUES (
        v_admin.user_id,
        'marketplace_activation_request',
        'Nova adesão ao Marketplace',
        'A oficina "' || COALESCE(v_shop.name,'(sem nome)') || '" pediu adesão ao Marketplace.',
        '/admin/market-activations',
        jsonb_build_object(
          'shop_id', _shop_id,
          'request_id', v_req_id,
          'shop_name', v_shop.name,
          'owner_name', v_owner_name,
          'shop_email', v_shop.email,
          'shop_phone', v_shop.phone,
          'shop_nif', v_shop.nif,
          'requested_at', now()
        )
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'status', 'pending', 'request_id', v_req_id);
END;
$$;

REVOKE ALL ON FUNCTION public.activate_marketplace_for_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_marketplace_for_shop(uuid) TO authenticated;

-- D) Backfill: criar notificações em falta para pedidos pendentes existentes
DO $$
DECLARE
  r record; a record; v_shop record; v_email text;
BEGIN
  FOR r IN SELECT * FROM public.marketplace_activation_requests WHERE status = 'pending' LOOP
    SELECT * INTO v_shop FROM public.shops WHERE id = r.shop_id;
    BEGIN SELECT email INTO v_email FROM auth.users WHERE id = r.user_id;
    EXCEPTION WHEN OTHERS THEN v_email := NULL; END;
    FOR a IN
      SELECT DISTINCT user_id FROM public.user_roles
      WHERE role IN ('admin'::app_role, 'super_admin'::app_role, 'commercial_admin'::app_role)
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = a.user_id
          AND type = 'marketplace_activation_request'
          AND (data->>'request_id') = r.id::text
      ) THEN
        BEGIN
          INSERT INTO public.notifications (user_id, type, title, message, link, data)
          VALUES (
            a.user_id,
            'marketplace_activation_request',
            'Nova adesão ao Marketplace',
            'A oficina "' || COALESCE(v_shop.name,'(sem nome)') || '" pediu adesão ao Marketplace.',
            '/admin/market-activations',
            jsonb_build_object(
              'shop_id', r.shop_id,
              'request_id', r.id,
              'shop_name', v_shop.name,
              'owner_name', COALESCE(v_shop.owner_name, v_email),
              'shop_email', v_shop.email,
              'shop_phone', v_shop.phone,
              'shop_nif', v_shop.nif,
              'requested_at', r.requested_at
            )
          );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END LOOP;
  END LOOP;
END $$;
