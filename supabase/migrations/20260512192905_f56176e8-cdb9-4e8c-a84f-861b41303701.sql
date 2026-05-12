
-- Normalize existing data: strip spaces, uppercase
UPDATE public.carity_seller_profiles
   SET dealer_nif = upper(regexp_replace(dealer_nif, '\s+', '', 'g'))
 WHERE dealer_nif IS NOT NULL;

-- Unique partial index: only dealer accounts must have unique NIF
CREATE UNIQUE INDEX IF NOT EXISTS uq_carity_seller_profiles_dealer_nif
  ON public.carity_seller_profiles ((upper(regexp_replace(dealer_nif, '\s+', '', 'g'))))
  WHERE account_type = 'dealer' AND dealer_nif IS NOT NULL;

-- Public availability check (anti-fraud signup gate)
CREATE OR REPLACE FUNCTION public.dealer_nif_available(_nif text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.carity_seller_profiles
    WHERE account_type = 'dealer'
      AND upper(regexp_replace(dealer_nif, '\s+', '', 'g'))
        = upper(regexp_replace(coalesce(_nif, ''), '\s+', '', 'g'))
      AND coalesce(_nif, '') <> ''
  );
$$;

GRANT EXECUTE ON FUNCTION public.dealer_nif_available(text) TO anon, authenticated;

-- Normalize + duplicate guard trigger
CREATE OR REPLACE FUNCTION public.normalize_and_check_dealer_nif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_type = 'dealer' THEN
    IF NEW.dealer_nif IS NULL OR length(trim(NEW.dealer_nif)) = 0 THEN
      RAISE EXCEPTION 'NIF é obrigatório para contas de Stand'
        USING ERRCODE = '23514';
    END IF;

    NEW.dealer_nif := upper(regexp_replace(NEW.dealer_nif, '\s+', '', 'g'));

    IF EXISTS (
      SELECT 1 FROM public.carity_seller_profiles
      WHERE account_type = 'dealer'
        AND user_id <> NEW.user_id
        AND upper(regexp_replace(dealer_nif, '\s+', '', 'g')) = NEW.dealer_nif
    ) THEN
      RAISE EXCEPTION 'Este NIF já está registado por outro Stand. Contacte suporte se acredita que é um erro.'
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_dealer_nif ON public.carity_seller_profiles;
CREATE TRIGGER trg_normalize_dealer_nif
BEFORE INSERT OR UPDATE OF dealer_nif, account_type
ON public.carity_seller_profiles
FOR EACH ROW
EXECUTE FUNCTION public.normalize_and_check_dealer_nif();
