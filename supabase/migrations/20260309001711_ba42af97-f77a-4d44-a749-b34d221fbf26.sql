
-- Add portal_token to clients for public portal access
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS portal_token uuid DEFAULT gen_random_uuid();

-- Create index for fast portal token lookups
CREATE INDEX IF NOT EXISTS idx_clients_portal_token ON public.clients(portal_token) WHERE portal_token IS NOT NULL;

-- RLS policy: allow public read access to client via portal_token
CREATE POLICY "Public client access via portal token"
ON public.clients
FOR SELECT
USING (portal_token IS NOT NULL);

-- Allow public to read work_orders, quotes, invoices for portal clients
CREATE POLICY "Public portal access to work_orders"
ON public.work_orders
FOR SELECT
USING (client_id IN (SELECT id FROM public.clients WHERE portal_token IS NOT NULL));

CREATE POLICY "Public portal access to invoices"
ON public.invoices
FOR SELECT
USING (client_id IN (SELECT id FROM public.clients WHERE portal_token IS NOT NULL));

-- Allow public to read vehicles for portal clients
CREATE POLICY "Public portal access to vehicles"
ON public.vehicles
FOR SELECT
USING (client_id IN (SELECT id FROM public.clients WHERE portal_token IS NOT NULL));
