-- Add unique constraint on platform_settings.key for upsert support
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_key_unique UNIQUE (key);

-- Add index on shops for faster lookups
CREATE INDEX IF NOT EXISTS idx_shops_user_id ON public.shops(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_users_user_id ON public.shop_users(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_shop_id ON public.clients(shop_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_shop_id ON public.vehicles(shop_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_shop_id ON public.work_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_quotes_shop_id ON public.quotes(shop_id);
CREATE INDEX IF NOT EXISTS idx_alerts_shop_id ON public.alerts(shop_id);