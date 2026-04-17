-- Update defaults for new inspections
ALTER TABLE public.carity_inspections
  ALTER COLUMN payment_amount SET DEFAULT 29.90,
  ALTER COLUMN shop_share SET DEFAULT 17.00,
  ALTER COLUMN platform_share SET DEFAULT 12.90;

-- Update existing UNPAID/PENDING inspections to new prices (don't touch completed/paid ones)
UPDATE public.carity_inspections
SET payment_amount = 29.90, shop_share = 17.00, platform_share = 12.90
WHERE payment_status IN ('pending', 'unpaid')
  AND status NOT IN ('completed', 'cancelled')
  AND payment_amount = 24.90;

-- Make wallet credit trigger country-aware
CREATE OR REPLACE FUNCTION public.credit_shop_wallet_on_inspection_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  share numeric;
  shop_country text;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.payment_status = 'paid' THEN
    -- Try to get share from country_settings via shop's country
    SELECT s.country_code INTO shop_country FROM public.shops s WHERE s.id = NEW.shop_id;
    IF shop_country IS NOT NULL THEN
      SELECT cs.inspection_shop_share INTO share
      FROM public.country_settings cs WHERE cs.code = shop_country AND cs.active = true;
    END IF;

    -- Fallback to inspection's own shop_share or 17.00
    IF share IS NULL OR share = 0 THEN
      share := COALESCE(NEW.shop_share, 17.00);
    END IF;

    -- Ensure wallet exists
    INSERT INTO public.shop_wallets (shop_id, balance, total_earned)
    VALUES (NEW.shop_id, 0, 0)
    ON CONFLICT (shop_id) DO NOTHING;

    -- Credit balance
    UPDATE public.shop_wallets
    SET balance = balance + share,
        total_earned = total_earned + share,
        updated_at = now()
    WHERE shop_id = NEW.shop_id;

    -- Log transaction
    INSERT INTO public.shop_wallet_transactions (shop_id, inspection_id, type, amount, description)
    VALUES (NEW.shop_id, NEW.id, 'credit', share,
      'Inspeção Market concluída #' || substr(NEW.id::text, 1, 8));
  END IF;
  RETURN NEW;
END;
$function$;