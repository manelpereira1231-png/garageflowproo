
-- =========================================================
-- AUTOPILOTO DE MARKETING — tabelas
-- =========================================================

CREATE TABLE public.marketing_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generated_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  strategy TEXT NOT NULL,                -- ex: "eficiência", "poupança", "crescimento"
  angle TEXT,                            -- ângulo de marketing
  target_audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  channels TEXT[] NOT NULL DEFAULT '{}', -- ['google_ads','meta_ads']
  keywords TEXT[] NOT NULL DEFAULT '{}',
  geo TEXT[] NOT NULL DEFAULT '{Portugal}',
  headlines TEXT[] NOT NULL DEFAULT '{}',
  descriptions TEXT[] NOT NULL DEFAULT '{}',
  ctas TEXT[] NOT NULL DEFAULT '{}',
  ab_variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  forecast JSONB,                        -- CTR, CPC, CPL, conv, CAC, ROI estimados
  market TEXT NOT NULL DEFAULT 'Portugal',
  monthly_budget_eur NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | active | paused | archived
  ai_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_campaigns_super_admin_all"
ON public.marketing_campaigns FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- =========================================================

CREATE TABLE public.marketing_creatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generated_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  creative_type TEXT NOT NULL,           -- 'dashboard_overlay','mechanic_tablet','modern_shop','growth_chart','before_after'
  prompt TEXT NOT NULL,
  image_url TEXT,                        -- URL pública do bucket
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'ready',  -- generating | ready | failed
  error TEXT,
  ai_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_creatives TO authenticated;
GRANT ALL ON public.marketing_creatives TO service_role;
ALTER TABLE public.marketing_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_creatives_super_admin_all"
ON public.marketing_creatives FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- =========================================================

CREATE TABLE public.marketing_optimizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  performed_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  iteration INT NOT NULL DEFAULT 1,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,  -- o que mudou (copy, criativos, CTA, audience)
  reasoning TEXT,                              -- racional da IA
  simulated_metrics JSONB,                     -- forecast pós-otimização
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_optimizations TO authenticated;
GRANT ALL ON public.marketing_optimizations TO service_role;
ALTER TABLE public.marketing_optimizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_optimizations_super_admin_all"
ON public.marketing_optimizations FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- =========================================================
-- updated_at trigger para campaigns
-- =========================================================

CREATE OR REPLACE FUNCTION public.tg_marketing_campaigns_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketing_campaigns_updated_at
BEFORE UPDATE ON public.marketing_campaigns
FOR EACH ROW EXECUTE FUNCTION public.tg_marketing_campaigns_updated_at();

-- Indexes úteis
CREATE INDEX idx_marketing_campaigns_status ON public.marketing_campaigns(status, created_at DESC);
CREATE INDEX idx_marketing_creatives_campaign ON public.marketing_creatives(campaign_id, created_at DESC);
CREATE INDEX idx_marketing_opts_campaign ON public.marketing_optimizations(campaign_id, iteration DESC);
