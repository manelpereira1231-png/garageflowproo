-- =========================================================
-- Centro Financeiro (Admin) — despesas, definições e auditoria
-- Acesso restrito a super_admin. Nada existente é alterado.
-- =========================================================

CREATE TABLE public.platform_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  category text NOT NULL,
  subcategory text,
  vendor text,
  amount_net numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  amount_total numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  is_recurring boolean NOT NULL DEFAULT false,
  frequency text,                     -- monthly | quarterly | yearly | other
  next_due_date date,
  payment_method text,
  document_url text,
  notes text,
  source text NOT NULL DEFAULT 'manual',      -- manual | api | database | estimate
  cost_type text NOT NULL DEFAULT 'operational', -- operational | growth
  acquisition_channel text,           -- google_ads | meta_ads | ... (CAC/ROI)
  is_paid boolean NOT NULL DEFAULT true,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_expenses TO authenticated;
GRANT ALL ON public.platform_expenses TO service_role;
ALTER TABLE public.platform_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage platform expenses"
  ON public.platform_expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_platform_expenses_date ON public.platform_expenses (expense_date DESC);
CREATE INDEX idx_platform_expenses_category ON public.platform_expenses (category);
CREATE INDEX idx_platform_expenses_recurring ON public.platform_expenses (is_recurring) WHERE is_recurring;

-- Categorias personalizadas ------------------------------------------------
CREATE TABLE public.platform_expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_category text,
  cost_type text NOT NULL DEFAULT 'operational',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, parent_category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_expense_categories TO authenticated;
GRANT ALL ON public.platform_expense_categories TO service_role;
ALTER TABLE public.platform_expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage expense categories"
  ON public.platform_expense_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Definições financeiras (linha única) -------------------------------------
CREATE TABLE public.platform_finance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  min_cash_reserve numeric(14,2) NOT NULL DEFAULT 0,
  known_bank_balance numeric(14,2),          -- NULL = não disponível
  known_bank_balance_updated_at timestamptz,
  assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  alert_thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.platform_finance_settings TO authenticated;
GRANT ALL ON public.platform_finance_settings TO service_role;
ALTER TABLE public.platform_finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage finance settings"
  ON public.platform_finance_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.platform_finance_settings (singleton) VALUES (true);

-- Auditoria financeira ------------------------------------------------------
CREATE TABLE public.platform_finance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,      -- expense | category | settings
  entity_id uuid,
  action text NOT NULL,           -- insert | update | delete
  old_values jsonb,
  new_values jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_finance_audit TO authenticated;
GRANT ALL ON public.platform_finance_audit TO service_role;
ALTER TABLE public.platform_finance_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read finance audit"
  ON public.platform_finance_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_platform_finance_audit_created ON public.platform_finance_audit (created_at DESC);

-- Triggers ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_finance_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_platform_expenses_touch BEFORE UPDATE ON public.platform_expenses
  FOR EACH ROW EXECUTE FUNCTION public.platform_finance_touch_updated_at();
CREATE TRIGGER trg_platform_expense_categories_touch BEFORE UPDATE ON public.platform_expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.platform_finance_touch_updated_at();
CREATE TRIGGER trg_platform_finance_settings_touch BEFORE UPDATE ON public.platform_finance_settings
  FOR EACH ROW EXECUTE FUNCTION public.platform_finance_touch_updated_at();

CREATE OR REPLACE FUNCTION public.platform_finance_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity text;
BEGIN
  v_entity := CASE TG_TABLE_NAME
    WHEN 'platform_expenses' THEN 'expense'
    WHEN 'platform_expense_categories' THEN 'category'
    ELSE 'settings'
  END;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.platform_finance_audit (entity_type, entity_id, action, old_values, user_id)
    VALUES (v_entity, OLD.id, 'delete', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.platform_finance_audit (entity_type, entity_id, action, old_values, new_values, user_id)
    VALUES (v_entity, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSE
    INSERT INTO public.platform_finance_audit (entity_type, entity_id, action, new_values, user_id)
    VALUES (v_entity, NEW.id, 'insert', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_platform_expenses_audit AFTER INSERT OR UPDATE OR DELETE ON public.platform_expenses
  FOR EACH ROW EXECUTE FUNCTION public.platform_finance_audit_log();
CREATE TRIGGER trg_platform_expense_categories_audit AFTER INSERT OR UPDATE OR DELETE ON public.platform_expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.platform_finance_audit_log();
CREATE TRIGGER trg_platform_finance_settings_audit AFTER INSERT OR UPDATE ON public.platform_finance_settings
  FOR EACH ROW EXECUTE FUNCTION public.platform_finance_audit_log();