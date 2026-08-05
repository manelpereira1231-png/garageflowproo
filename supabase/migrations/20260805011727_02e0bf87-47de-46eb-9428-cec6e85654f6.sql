
-- 1) Global certification settings (singleton)
CREATE TABLE public.saft_certification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true,
  is_certified boolean NOT NULL DEFAULT false,
  software_certificate_number text,
  product_id text NOT NULL DEFAULT 'GarageFlow',
  product_version text NOT NULL DEFAULT '1.0',
  producer_company_name text,
  producer_tax_id text,
  saft_version text NOT NULL DEFAULT '1.04_01',
  tax_accounting_basis text NOT NULL DEFAULT 'F',
  signing_enabled boolean NOT NULL DEFAULT false,
  signing_key_secret_name text NOT NULL DEFAULT 'SAFT_SIGNING_PRIVATE_KEY',
  signing_public_key text,
  signing_key_version text NOT NULL DEFAULT '1',
  header_comment_override text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saft_certification_singleton_uq UNIQUE (singleton)
);

GRANT SELECT, INSERT, UPDATE ON public.saft_certification_settings TO authenticated;
GRANT ALL ON public.saft_certification_settings TO service_role;
ALTER TABLE public.saft_certification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saft_cert_super_admin_read" ON public.saft_certification_settings
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "saft_cert_super_admin_insert" ON public.saft_certification_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "saft_cert_super_admin_update" ON public.saft_certification_settings
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.saft_certification_settings (singleton) VALUES (true);

-- 2) Document series (per shop) — ATCUD base
CREATE TABLE public.document_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  series_code text NOT NULL,
  at_validation_code text,
  initial_sequence integer NOT NULL DEFAULT 1,
  current_sequence integer NOT NULL DEFAULT 0,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_series_unique UNIQUE (shop_id, doc_type, series_code)
);

CREATE INDEX document_series_shop_idx ON public.document_series(shop_id, doc_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_series TO authenticated;
GRANT ALL ON public.document_series TO service_role;
ALTER TABLE public.document_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_series_shop_read" ON public.document_series
  FOR SELECT TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE POLICY "document_series_shop_insert" ON public.document_series
  FOR INSERT TO authenticated
  WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE POLICY "document_series_shop_update" ON public.document_series
  FOR UPDATE TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()))
  WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));
CREATE POLICY "document_series_shop_delete" ON public.document_series
  FOR DELETE TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));

-- 3) Document signature chain
CREATE TABLE public.document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  doc_id uuid NOT NULL,
  doc_number text NOT NULL,
  series_id uuid REFERENCES public.document_series(id) ON DELETE SET NULL,
  sequence_number integer,
  atcud text,
  doc_date date NOT NULL,
  system_entry_date timestamptz NOT NULL,
  gross_total numeric(14,2) NOT NULL DEFAULT 0,
  source_string text NOT NULL,
  previous_hash text,
  hash text NOT NULL,
  hash_control text NOT NULL DEFAULT '0',
  key_version text NOT NULL DEFAULT '1',
  algorithm text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_signatures_unique UNIQUE (shop_id, doc_type, doc_id)
);

CREATE INDEX document_signatures_chain_idx ON public.document_signatures(shop_id, doc_type, system_entry_date);

GRANT SELECT ON public.document_signatures TO authenticated;
GRANT ALL ON public.document_signatures TO service_role;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_signatures_shop_read" ON public.document_signatures
  FOR SELECT TO authenticated
  USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())) OR public.is_super_admin(auth.uid()));

-- 4) updated_at triggers
CREATE OR REPLACE FUNCTION public.saft_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER saft_cert_touch BEFORE UPDATE ON public.saft_certification_settings
  FOR EACH ROW EXECUTE FUNCTION public.saft_touch_updated_at();
CREATE TRIGGER document_series_touch BEFORE UPDATE ON public.document_series
  FOR EACH ROW EXECUTE FUNCTION public.saft_touch_updated_at();
