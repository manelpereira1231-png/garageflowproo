
ALTER TABLE public.carity_inspection_reports
  ADD COLUMN IF NOT EXISTS risk_score int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audit_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS risk_calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS inspection_duration_seconds int;

CREATE INDEX IF NOT EXISTS idx_inspection_reports_risk_level ON public.carity_inspection_reports (risk_level);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_audit_status ON public.carity_inspection_reports (audit_status);

CREATE TABLE IF NOT EXISTS public.workshop_trust_scores (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 70,
  level text NOT NULL DEFAULT 'silver',
  total_inspections int NOT NULL DEFAULT 0,
  flagged_inspections int NOT NULL DEFAULT 0,
  audited_failed int NOT NULL DEFAULT 0,
  avg_risk_score numeric NOT NULL DEFAULT 0,
  approval_rate numeric NOT NULL DEFAULT 0,
  last_recalculated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workshop_trust_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read trust scores" ON public.workshop_trust_scores;
CREATE POLICY "Super admins read trust scores" ON public.workshop_trust_scores
  FOR SELECT USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Shop owner reads own trust" ON public.workshop_trust_scores;
CREATE POLICY "Shop owner reads own trust" ON public.workshop_trust_scores
  FOR SELECT USING (public.user_owns_shop(auth.uid(), shop_id));
