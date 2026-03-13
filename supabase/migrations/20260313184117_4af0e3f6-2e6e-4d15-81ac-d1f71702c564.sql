
-- Suppliers table
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  discount_percent numeric NOT NULL DEFAULT 0,
  integration_active boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage suppliers" ON public.suppliers
  FOR ALL TO public
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Supplier invites table
CREATE TABLE public.supplier_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  shop_name text NOT NULL DEFAULT '',
  shop_email text NOT NULL,
  shop_phone text NOT NULL DEFAULT '',
  invite_token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  discount_percent numeric NOT NULL DEFAULT 0,
  plan_offer text NOT NULL DEFAULT 'pro',
  trial_days integer NOT NULL DEFAULT 30,
  sent_at timestamptz,
  accepted_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  shop_id uuid REFERENCES public.shops(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage supplier_invites" ON public.supplier_invites
  FOR ALL TO public
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Allow anon to read invite by token (for accepting)
CREATE POLICY "Public read invite by token" ON public.supplier_invites
  FOR SELECT TO anon
  USING (invite_token IS NOT NULL);
