-- 1) Fecha exposição pública do verification_token nos relatórios de inspeção
REVOKE SELECT (verification_token) ON public.carity_inspection_reports FROM anon;
REVOKE SELECT (verification_token) ON public.carity_inspection_reports FROM authenticated;
GRANT SELECT (verification_token) ON public.carity_inspection_reports TO service_role;

-- RPC para donos legítimos (oficina que emitiu, super-admin, vendedor)
CREATE OR REPLACE FUNCTION public.get_inspection_verification_token(_report_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT r.verification_token
  FROM public.carity_inspection_reports r
  WHERE r.id = _report_id
    AND (
      r.shop_id IN (SELECT public.get_user_shop_ids(auth.uid()))
      OR public.is_super_admin(auth.uid())
      OR r.listing_id IN (
        SELECT id FROM public.carity_listings WHERE seller_id = auth.uid()
      )
    )
$$;
GRANT EXECUTE ON FUNCTION public.get_inspection_verification_token(uuid) TO authenticated;

-- 2) Integração de faturação certificada por oficina (multi-tenant)
CREATE TABLE IF NOT EXISTS public.integracao_faturacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('invoicexpress','moloni')),
  account_name text NOT NULL,
  api_key_encrypted text NOT NULL,
  serie_default text,
  documento_default text NOT NULL DEFAULT 'invoice',
  ativo boolean NOT NULL DEFAULT true,
  last_test_ok_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integracao_faturacao TO authenticated;
GRANT ALL ON public.integracao_faturacao TO service_role;

ALTER TABLE public.integracao_faturacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners manage integration"
  ON public.integracao_faturacao
  FOR ALL
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_touch_integracao_faturacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_integracao_faturacao_updated
BEFORE UPDATE ON public.integracao_faturacao
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_integracao_faturacao();

-- 3) Extender invoices com metadata do documento certificado devolvido pelo provider
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_invoice_id text,
  ADD COLUMN IF NOT EXISTS atcud text,
  ADD COLUMN IF NOT EXISTS provider_pdf_url text,
  ADD COLUMN IF NOT EXISTS provider_permalink text,
  ADD COLUMN IF NOT EXISTS emitida_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_shop_provider_id_uidx
  ON public.invoices (shop_id, provider, provider_invoice_id)
  WHERE provider_invoice_id IS NOT NULL;