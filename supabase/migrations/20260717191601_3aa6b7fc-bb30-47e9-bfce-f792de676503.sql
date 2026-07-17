
DROP POLICY IF EXISTS "Sellers respond to offers" ON public.carity_offers;
CREATE POLICY "Sellers respond to offers"
ON public.carity_offers
FOR UPDATE
TO authenticated
USING (seller_id = auth.uid() AND status = 'pending' AND responded_at IS NULL)
WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "Users send messages" ON public.carity_chat_messages;
CREATE POLICY "Users send messages"
ON public.carity_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND sender_id <> receiver_id
  AND EXISTS (
    SELECT 1 FROM public.carity_listings l
    WHERE l.id = listing_id
      AND (
        (l.seller_id = receiver_id AND sender_id <> l.seller_id)
        OR (l.seller_id = sender_id AND (
          EXISTS (SELECT 1 FROM public.carity_chat_messages m
                  WHERE m.listing_id = listing_id AND m.sender_id = receiver_id)
          OR EXISTS (SELECT 1 FROM public.carity_offers o
                     WHERE o.listing_id = listing_id AND o.buyer_id = receiver_id)
        ))
      )
  )
);

DROP POLICY IF EXISTS "Buyers view own confirmations by email" ON public.sale_confirmations;
CREATE POLICY "Buyers view own confirmations by escrow"
ON public.sale_confirmations
FOR SELECT
TO authenticated
USING (
  confirmed_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.market_escrow e
    WHERE e.listing_id = sale_confirmations.listing_id
      AND e.buyer_id = auth.uid()
      AND e.stripe_verified = true
  )
);
