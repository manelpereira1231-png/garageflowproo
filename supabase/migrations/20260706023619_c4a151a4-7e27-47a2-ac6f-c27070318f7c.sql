ALTER TABLE public.integracao_faturacao
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moloni_company_id INTEGER;