DROP INDEX IF EXISTS public.shop_commercial_conditions_one_live_idx;

CREATE UNIQUE INDEX shop_commercial_conditions_one_live_idx
ON public.shop_commercial_conditions(shop_id)
WHERE status IN ('pending','active','scheduled');

COMMENT ON INDEX public.shop_commercial_conditions_one_live_idx IS
'Only a successfully pending, active, or scheduled condition can be live; failed attempts remain immutable audit history.';