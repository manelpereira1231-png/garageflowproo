
-- Fase 1: expandir roles + capabilities + perfis
ALTER TABLE public.shop_users DROP CONSTRAINT IF EXISTS shop_users_role_check;
ALTER TABLE public.shop_users ADD CONSTRAINT shop_users_role_check
  CHECK (role = ANY (ARRAY['owner','admin','manager','reception','technician','commercial','super_admin']));

-- Perfil rico do colaborador (nome, telefone, cargo, foto, ativo, skills)
CREATE TABLE IF NOT EXISTS public.shop_user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_user_id uuid NOT NULL UNIQUE REFERENCES public.shop_users(id) ON DELETE CASCADE,
  name text,
  phone text,
  position text,
  avatar_url text,
  skills text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  suspended_at timestamptz,
  must_reset_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_user_profiles TO authenticated;
GRANT ALL ON public.shop_user_profiles TO service_role;
ALTER TABLE public.shop_user_profiles ENABLE ROW LEVEL SECURITY;

-- Membros da mesma oficina podem ver perfis; apenas owner/admin podem escrever
CREATE POLICY "profiles_read_same_shop" ON public.shop_user_profiles
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.shop_users su
    WHERE su.id = shop_user_profiles.shop_user_id
      AND su.shop_id IN (SELECT shop_id FROM public.shop_users WHERE user_id = auth.uid())
  )
);

CREATE POLICY "profiles_self_update" ON public.shop_user_profiles
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.shop_users su WHERE su.id = shop_user_profiles.shop_user_id AND su.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.shop_users su WHERE su.id = shop_user_profiles.shop_user_id AND su.user_id = auth.uid())
);

CREATE POLICY "profiles_admin_manage" ON public.shop_user_profiles
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.shop_users me
    JOIN public.shop_users target ON target.id = shop_user_profiles.shop_user_id
    WHERE me.user_id = auth.uid()
      AND me.shop_id = target.shop_id
      AND me.role IN ('owner','admin')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shop_users me
    JOIN public.shop_users target ON target.id = shop_user_profiles.shop_user_id
    WHERE me.user_id = auth.uid()
      AND me.shop_id = target.shop_id
      AND me.role IN ('owner','admin')
  )
);

CREATE TRIGGER trg_shop_user_profiles_updated_at
BEFORE UPDATE ON public.shop_user_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função: role do utilizador corrente na oficina
CREATE OR REPLACE FUNCTION public.current_shop_role(_shop_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.shop_users
  WHERE shop_id = _shop_id AND user_id = auth.uid()
  LIMIT 1
$$;

-- Função: matriz canónica role → capability
CREATE OR REPLACE FUNCTION public.has_capability(_shop_id uuid, _cap text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  SELECT role INTO r FROM public.shop_users
  WHERE shop_id = _shop_id AND user_id = auth.uid()
  LIMIT 1;
  IF r IS NULL THEN RETURN false; END IF;

  -- Owner e super_admin: tudo
  IF r IN ('owner','super_admin') THEN RETURN true; END IF;

  -- Admin: tudo exceto transferência de propriedade
  IF r = 'admin' THEN
    RETURN _cap <> 'settings.transfer_ownership' AND _cap <> 'team.remove_owner';
  END IF;

  -- Manager: operacional completo + finance limitada
  IF r = 'manager' THEN
    RETURN _cap = ANY (ARRAY[
      'clients.view','clients.create','clients.edit','clients.delete',
      'vehicles.view','vehicles.create','vehicles.edit','vehicles.delete',
      'quotes.view','quotes.create','quotes.edit','quotes.approve',
      'work_orders.view','work_orders.create','work_orders.edit','work_orders.complete',
      'invoices.view','invoices.create','invoices.cancel',
      'finance.view_costs','finance.view_profits',
      'stock.view','stock.manage','purchases.view','purchases.manage',
      'agenda.view','agenda.manage','marketplace.view',
      'team.view','audit.view'
    ]);
  END IF;

  -- Receção: front-office
  IF r = 'reception' THEN
    RETURN _cap = ANY (ARRAY[
      'clients.view','clients.create','clients.edit',
      'vehicles.view','vehicles.create','vehicles.edit',
      'quotes.view','quotes.create','quotes.edit',
      'work_orders.view','work_orders.create',
      'agenda.view','agenda.manage',
      'invoices.view'
    ]);
  END IF;

  -- Comercial: leads/vendas
  IF r = 'commercial' THEN
    RETURN _cap = ANY (ARRAY[
      'clients.view','clients.create','clients.edit',
      'vehicles.view','vehicles.create',
      'quotes.view','quotes.create','quotes.edit',
      'agenda.view'
    ]);
  END IF;

  -- Técnico: apenas painel Workshop
  IF r = 'technician' THEN
    RETURN _cap = ANY (ARRAY[
      'work_orders.view','work_orders.edit','work_orders.complete',
      'clients.view','vehicles.view','agenda.view'
    ]);
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_shop_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text) TO authenticated;

-- Criar automaticamente perfil quando novo shop_user é criado
CREATE OR REPLACE FUNCTION public.create_shop_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.shop_user_profiles (shop_user_id)
  VALUES (NEW.id)
  ON CONFLICT (shop_user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_users_create_profile ON public.shop_users;
CREATE TRIGGER trg_shop_users_create_profile
AFTER INSERT ON public.shop_users
FOR EACH ROW EXECUTE FUNCTION public.create_shop_user_profile();

-- Retropovoar para membros existentes
INSERT INTO public.shop_user_profiles (shop_user_id)
SELECT id FROM public.shop_users
ON CONFLICT (shop_user_id) DO NOTHING;
