-- 1) Vistas públicas sem identificadores Stripe (definer: não exigem acesso às tabelas base)
ALTER VIEW public.plans_public SET (security_invoker = false);
ALTER VIEW public.plan_country_prices_public SET (security_invoker = false);

CREATE OR REPLACE VIEW public.plan_promotions_public AS
SELECT id, country_code, plan, cycle, promo_price, currency, active, starts_at, ends_at, notes, created_at, updated_at
FROM public.plan_promotions;
ALTER VIEW public.plan_promotions_public SET (security_invoker = false);

GRANT SELECT ON public.plans_public TO anon, authenticated;
GRANT SELECT ON public.plan_country_prices_public TO anon, authenticated;
GRANT SELECT ON public.plan_promotions_public TO anon, authenticated;

-- 2) Remover leitura direta das tabelas base (contêm colunas Stripe)
DROP POLICY IF EXISTS "plans_public_read" ON public.plans;
DROP POLICY IF EXISTS "plan_country_prices authenticated read" ON public.plan_country_prices;
DROP POLICY IF EXISTS "Anyone can view plan promotions" ON public.plan_promotions;

REVOKE SELECT ON public.plans FROM anon;
REVOKE SELECT ON public.plan_country_prices FROM anon, authenticated;
REVOKE SELECT ON public.plan_promotions FROM anon, authenticated;

-- Super admins continuam a ler/escrever via as políticas "manage/admin_write" existentes.
GRANT SELECT ON public.plans TO authenticated;

-- 3) Fornecedores (tabelas legadas): fim da leitura cross-tenant
DROP POLICY IF EXISTS "Authenticated users read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users read supplier_parts" ON public.supplier_parts;

CREATE POLICY "suppliers super admin read"
  ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "supplier_parts super admin read"
  ON public.supplier_parts FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

REVOKE SELECT ON public.supplier_parts FROM anon;
REVOKE SELECT ON public.suppliers FROM anon;