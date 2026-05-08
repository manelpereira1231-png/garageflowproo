
-- 1) Account type + dealer fields on seller profiles
ALTER TABLE public.carity_seller_profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'particular',
  ADD COLUMN IF NOT EXISTS dealer_company_name text,
  ADD COLUMN IF NOT EXISTS dealer_nif text,
  ADD COLUMN IF NOT EXISTS dealer_license text,
  ADD COLUMN IF NOT EXISTS dealer_logo_url text,
  ADD COLUMN IF NOT EXISTS dealer_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS dealer_city text,
  ADD COLUMN IF NOT EXISTS dealer_plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS dealer_active_until timestamptz,
  ADD COLUMN IF NOT EXISTS dealer_description text;

ALTER TABLE public.carity_seller_profiles
  DROP CONSTRAINT IF EXISTS carity_seller_profiles_account_type_check;
ALTER TABLE public.carity_seller_profiles
  ADD CONSTRAINT carity_seller_profiles_account_type_check
  CHECK (account_type IN ('particular','dealer'));

ALTER TABLE public.carity_seller_profiles
  DROP CONSTRAINT IF EXISTS carity_seller_profiles_dealer_plan_check;
ALTER TABLE public.carity_seller_profiles
  ADD CONSTRAINT carity_seller_profiles_dealer_plan_check
  CHECK (dealer_plan IN ('free','starter','pro','unlimited'));

CREATE INDEX IF NOT EXISTS idx_seller_profiles_account_type
  ON public.carity_seller_profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_dealer_slug
  ON public.carity_seller_profiles(dealer_slug);

-- 2) Independent inspection flag on listings
ALTER TABLE public.carity_listings
  ADD COLUMN IF NOT EXISTS requires_independent_inspection boolean NOT NULL DEFAULT false;

-- Auto-mark dealer listings
CREATE OR REPLACE FUNCTION public.mark_dealer_listing()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_dealer boolean;
BEGIN
  SELECT account_type = 'dealer' INTO _is_dealer
  FROM public.carity_seller_profiles
  WHERE user_id = NEW.seller_id;
  IF COALESCE(_is_dealer, false) THEN
    NEW.requires_independent_inspection := true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mark_dealer_listing ON public.carity_listings;
CREATE TRIGGER trg_mark_dealer_listing
BEFORE INSERT OR UPDATE OF seller_id ON public.carity_listings
FOR EACH ROW EXECUTE FUNCTION public.mark_dealer_listing();

-- 3) Anti-fraud: block dealer self-inspection
CREATE OR REPLACE FUNCTION public.block_dealer_self_inspection()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _seller_id uuid;
  _seller_nif text;
  _shop_owner uuid;
  _shop_nif text;
BEGIN
  SELECT seller_id INTO _seller_id FROM public.carity_listings WHERE id = NEW.listing_id;
  IF _seller_id IS NULL THEN RETURN NEW; END IF;

  SELECT user_id INTO _shop_owner FROM public.shops WHERE id = NEW.shop_id;

  -- Same owner = block
  IF _shop_owner = _seller_id THEN
    RAISE EXCEPTION 'DEALER_SELF_INSPECTION: O stand não pode inspecionar os próprios carros. Inspeção tem de ser feita por oficina independente.'
      USING ERRCODE = '42501';
  END IF;

  -- Same NIF = block (covers separate accounts of same legal entity)
  SELECT COALESCE(dealer_nif, nif) INTO _seller_nif
    FROM public.carity_seller_profiles WHERE user_id = _seller_id;
  SELECT nif INTO _shop_nif FROM public.shops WHERE id = NEW.shop_id;

  IF _seller_nif IS NOT NULL AND _shop_nif IS NOT NULL
     AND length(trim(_seller_nif)) > 0 AND trim(_seller_nif) = trim(_shop_nif) THEN
    RAISE EXCEPTION 'DEALER_SELF_INSPECTION_NIF: NIF da oficina coincide com o do stand. Inspeção independente obrigatória.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_block_dealer_self_inspection ON public.carity_inspections;
CREATE TRIGGER trg_block_dealer_self_inspection
BEFORE INSERT OR UPDATE OF shop_id ON public.carity_inspections
FOR EACH ROW EXECUTE FUNCTION public.block_dealer_self_inspection();

-- Same on offers
DROP TRIGGER IF EXISTS trg_block_dealer_self_offer ON public.carity_inspection_offers;
CREATE OR REPLACE FUNCTION public.block_dealer_self_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _seller_id uuid; _seller_nif text; _shop_owner uuid; _shop_nif text;
BEGIN
  SELECT seller_id INTO _seller_id FROM public.carity_listings WHERE id = NEW.listing_id;
  SELECT user_id INTO _shop_owner FROM public.shops WHERE id = NEW.shop_id;
  IF _shop_owner = _seller_id THEN
    RAISE EXCEPTION 'DEALER_SELF_INSPECTION' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(dealer_nif, nif) INTO _seller_nif FROM public.carity_seller_profiles WHERE user_id = _seller_id;
  SELECT nif INTO _shop_nif FROM public.shops WHERE id = NEW.shop_id;
  IF _seller_nif IS NOT NULL AND _shop_nif IS NOT NULL AND trim(_seller_nif) = trim(_shop_nif) THEN
    RAISE EXCEPTION 'DEALER_SELF_INSPECTION_NIF' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_block_dealer_self_offer
BEFORE INSERT OR UPDATE OF shop_id ON public.carity_inspection_offers
FOR EACH ROW EXECUTE FUNCTION public.block_dealer_self_offer();

-- 4) Quota check
CREATE OR REPLACE FUNCTION public.dealer_can_publish(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _plan text; _active_until timestamptz; _max int; _current int; _is_dealer boolean;
BEGIN
  SELECT account_type='dealer', dealer_plan, dealer_active_until
    INTO _is_dealer, _plan, _active_until
  FROM public.carity_seller_profiles WHERE user_id = _user_id;

  IF NOT COALESCE(_is_dealer, false) THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'particular');
  END IF;

  -- Expired plan acts as free
  IF _active_until IS NOT NULL AND _active_until < now() THEN
    _plan := 'free';
  END IF;

  _max := CASE _plan
    WHEN 'starter' THEN 10
    WHEN 'pro' THEN 30
    WHEN 'unlimited' THEN 99999
    ELSE 1
  END;

  SELECT count(*) INTO _current FROM public.carity_listings
  WHERE seller_id = _user_id AND status IN ('published','pending_inspection','inspection_in_progress','reserved');

  RETURN jsonb_build_object(
    'allowed', _current < _max,
    'plan', _plan, 'used', _current, 'max', _max,
    'reason', CASE WHEN _current < _max THEN 'ok' ELSE 'quota_exceeded' END
  );
END $$;

-- 5) Public dealer directory view
CREATE OR REPLACE VIEW public.dealer_directory AS
SELECT
  sp.user_id,
  sp.dealer_slug,
  sp.dealer_company_name,
  sp.dealer_logo_url,
  sp.dealer_city,
  sp.dealer_description,
  sp.country_code,
  sp.verified,
  sp.dealer_plan,
  COUNT(cl.id) FILTER (WHERE cl.status = 'published') AS active_listings,
  COUNT(cl.id) FILTER (WHERE cl.sold_at IS NOT NULL) AS total_sold
FROM public.carity_seller_profiles sp
LEFT JOIN public.carity_listings cl ON cl.seller_id = sp.user_id
WHERE sp.account_type = 'dealer'
  AND sp.dealer_slug IS NOT NULL
  AND sp.verified = true
GROUP BY sp.user_id, sp.dealer_slug, sp.dealer_company_name, sp.dealer_logo_url,
         sp.dealer_city, sp.dealer_description, sp.country_code, sp.verified, sp.dealer_plan;

GRANT SELECT ON public.dealer_directory TO anon, authenticated;
