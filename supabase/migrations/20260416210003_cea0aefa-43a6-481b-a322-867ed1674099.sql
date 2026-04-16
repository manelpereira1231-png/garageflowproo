
-- Localização do carro
ALTER TABLE public.carity_listings
  ADD COLUMN IF NOT EXISTS location_lat numeric,
  ADD COLUMN IF NOT EXISTS location_lng numeric,
  ADD COLUMN IF NOT EXISTS location_label text;

-- Janela de satisfação 48h
ALTER TABLE public.market_escrow
  ADD COLUMN IF NOT EXISTS satisfaction_window_ends_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancelled_within_window boolean NOT NULL DEFAULT false;

-- Assinaturas digitais
ALTER TABLE public.market_contracts
  ADD COLUMN IF NOT EXISTS buyer_signature_url text,
  ADD COLUMN IF NOT EXISTS seller_signature_url text;

-- Suspensão de vendedores
ALTER TABLE public.carity_seller_profiles
  ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('market-signatures', 'market-signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Policies KYC (privado, user na sua pasta)
DROP POLICY IF EXISTS "Users upload own KYC" ON storage.objects;
CREATE POLICY "Users upload own KYC"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users read own KYC" ON storage.objects;
CREATE POLICY "Users read own KYC"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_super_admin(auth.uid())));

DROP POLICY IF EXISTS "Admin manage KYC" ON storage.objects;
CREATE POLICY "Admin manage KYC"
ON storage.objects FOR ALL
USING (bucket_id = 'kyc-documents' AND public.is_super_admin(auth.uid()))
WITH CHECK (bucket_id = 'kyc-documents' AND public.is_super_admin(auth.uid()));

-- Policies signatures (públicas, leitura aberta para PDFs)
DROP POLICY IF EXISTS "Public read signatures" ON storage.objects;
CREATE POLICY "Public read signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'market-signatures');

DROP POLICY IF EXISTS "Users upload own signature" ON storage.objects;
CREATE POLICY "Users upload own signature"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'market-signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Função: suspender vendedor após 3 flags de evasão
CREATE OR REPLACE FUNCTION public.suspend_user_on_chat_evasion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_user uuid;
BEGIN
  IF NEW.flag_type <> 'chat_evasion_repeat' THEN
    RETURN NEW;
  END IF;

  v_user := NEW.entity_id;

  SELECT COUNT(*) INTO v_count
  FROM public.audit_risk_flags
  WHERE entity_id = v_user
    AND flag_type = 'chat_evasion_repeat'
    AND auto_resolved = false;

  IF v_count >= 3 THEN
    UPDATE public.carity_seller_profiles
       SET suspended_at = now(),
           suspension_reason = 'Suspensão automática: 3+ tentativas de evasão de chat'
     WHERE user_id = v_user
       AND suspended_at IS NULL;

    UPDATE public.carity_listings
       SET status = 'paused'
     WHERE seller_id = v_user
       AND status = 'published';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suspend_on_chat_evasion ON public.audit_risk_flags;
CREATE TRIGGER trg_suspend_on_chat_evasion
AFTER INSERT ON public.audit_risk_flags
FOR EACH ROW EXECUTE FUNCTION public.suspend_user_on_chat_evasion();

-- View pública: contagem de views por listing por dia (otimização)
CREATE OR REPLACE VIEW public.listing_view_stats AS
SELECT
  listing_id,
  COUNT(*) FILTER (WHERE viewed_date = (now() AT TIME ZONE 'utc')::date) AS views_today,
  COUNT(*) AS views_total
FROM public.listing_views
GROUP BY listing_id;

GRANT SELECT ON public.listing_view_stats TO anon, authenticated;
