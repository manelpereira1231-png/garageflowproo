
-- Add missing alert types to the check constraint
ALTER TABLE public.alerts DROP CONSTRAINT alerts_type_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_type_check CHECK (type = ANY (ARRAY['revision'::text, 'oil_change'::text, 'inspection'::text, 'warranty'::text, 'quote_expired'::text, 'inactive_client'::text, 'maintenance'::text, 'appointment'::text, 'payment_failed'::text]));
