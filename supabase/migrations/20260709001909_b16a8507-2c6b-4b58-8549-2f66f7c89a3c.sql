-- Fase 2 · Fonte única do país da oficina.
-- Impede que 'country', 'country_code' ou 'currency' sejam alterados após
-- a criação da oficina. Apenas super-administradores da plataforma podem
-- efetuar essa migração fiscal. Esta é uma defesa de backend — o formulário
-- de Definições já removeu os controlos, este trigger garante que ninguém
-- contorna via DevTools, API, chamadas diretas ou postman.

CREATE OR REPLACE FUNCTION public.enforce_shop_country_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
BEGIN
  -- If nothing sensitive changed, allow.
  IF NEW.country_code IS NOT DISTINCT FROM OLD.country_code
     AND NEW.country IS NOT DISTINCT FROM OLD.country
     AND NEW.currency IS NOT DISTINCT FROM OLD.currency
  THEN
    RETURN NEW;
  END IF;

  -- Super-admin bypass (uses existing helper).
  BEGIN
    SELECT public.is_super_admin() INTO v_is_super;
  EXCEPTION WHEN OTHERS THEN
    v_is_super := false;
  END;

  IF v_is_super THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'shop.country / country_code / currency are immutable after creation. Contact platform admin to change country.'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_shops_country_immutable ON public.shops;
CREATE TRIGGER trg_shops_country_immutable
BEFORE UPDATE ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.enforce_shop_country_immutability();