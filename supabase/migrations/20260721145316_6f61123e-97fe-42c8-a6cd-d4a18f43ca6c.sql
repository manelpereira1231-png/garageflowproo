
-- 1) market_contracts: remove forgeable INSERT policy. Contracts are created by
--    edge functions using service_role (which bypasses RLS). Super admins can
--    still insert via the "Super admin manage contracts" style — add explicit one.
DROP POLICY IF EXISTS "System inserts contracts" ON public.market_contracts;
CREATE POLICY "Super admin insert contracts"
  ON public.market_contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

-- 2) carity_chat_messages: fix tautological EXISTS correlations.
DROP POLICY IF EXISTS "Users send messages" ON public.carity_chat_messages;
CREATE POLICY "Users send messages"
  ON public.carity_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_id <> receiver_id
    AND EXISTS (
      SELECT 1
      FROM public.carity_listings l
      WHERE l.id = carity_chat_messages.listing_id
        AND (
          -- Buyer messaging the seller of this listing
          (l.seller_id = carity_chat_messages.receiver_id
             AND carity_chat_messages.sender_id <> l.seller_id)
          OR
          -- Seller replying to someone who already contacted / made an offer
          (l.seller_id = carity_chat_messages.sender_id
             AND (
               EXISTS (
                 SELECT 1 FROM public.carity_chat_messages m
                 WHERE m.listing_id = carity_chat_messages.listing_id
                   AND m.sender_id = carity_chat_messages.receiver_id
               )
               OR EXISTS (
                 SELECT 1 FROM public.carity_offers o
                 WHERE o.listing_id = carity_chat_messages.listing_id
                   AND o.buyer_id = carity_chat_messages.receiver_id
               )
             )
          )
        )
    )
  );

-- 3) partners: restrict which columns a partner can update on their own row.
--    Sensitive fields (commission_percentage, discount_percentage, status,
--    api_key, stripe_account_id, payout_iban, payout_mbway_phone, auth_user_id)
--    are only modifiable by super admins. Enforced via BEFORE UPDATE trigger
--    so that RLS ownership check remains simple.
CREATE OR REPLACE FUNCTION public.prevent_partner_sensitive_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow super admins to change anything
  IF is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Block changes to sensitive columns for non-admins
  IF NEW.commission_percentage IS DISTINCT FROM OLD.commission_percentage
     OR NEW.discount_percentage IS DISTINCT FROM OLD.discount_percentage
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.api_key IS DISTINCT FROM OLD.api_key
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.payout_iban IS DISTINCT FROM OLD.payout_iban
     OR NEW.payout_mbway_phone IS DISTINCT FROM OLD.payout_mbway_phone
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
  THEN
    RAISE EXCEPTION 'Não autorizado a alterar campos sensíveis de parceiro';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_partner_sensitive_self_update ON public.partners;
CREATE TRIGGER trg_prevent_partner_sensitive_self_update
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_partner_sensitive_self_update();
