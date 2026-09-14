ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_alerts_shop_status_read ON public.alerts (shop_id, status, read_at);