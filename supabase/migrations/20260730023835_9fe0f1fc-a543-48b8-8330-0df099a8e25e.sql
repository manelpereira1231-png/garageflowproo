UPDATE public.loyalty_points lp
SET total_earned = COALESCE(agg.earned, 0),
    total_redeemed = COALESCE(agg.redeemed, 0)
FROM (
  SELECT shop_id, client_id,
         SUM(CASE WHEN points > 0 THEN points ELSE 0 END) AS earned,
         SUM(CASE WHEN points < 0 THEN -points ELSE 0 END) AS redeemed
  FROM public.loyalty_transactions
  GROUP BY shop_id, client_id
) agg
WHERE agg.shop_id = lp.shop_id
  AND agg.client_id = lp.client_id
  AND (lp.total_earned IS DISTINCT FROM COALESCE(agg.earned, 0)
       OR lp.total_redeemed IS DISTINCT FROM COALESCE(agg.redeemed, 0));