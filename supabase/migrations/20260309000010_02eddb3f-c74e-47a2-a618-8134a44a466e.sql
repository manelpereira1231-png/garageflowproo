
-- Remove the unique constraint on user_id to allow multi-shop (GARAGE plan)
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_user_id_key;
