ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_fleet boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fleet_name text,
  ADD COLUMN IF NOT EXISTS fleet_manager text;

CREATE INDEX IF NOT EXISTS clients_is_fleet_idx ON public.clients (shop_id) WHERE is_fleet;