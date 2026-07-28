
-- ==========================================================================
-- TESTIMONIALS
-- ==========================================================================
CREATE TABLE public.testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL CHECK (char_length(author_name) BETWEEN 2 AND 120),
  workshop_name TEXT CHECK (workshop_name IS NULL OR char_length(workshop_name) <= 160),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 20 AND 400),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  featured BOOLEAN NOT NULL DEFAULT false,
  display_publicly BOOLEAN NOT NULL DEFAULT true,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only ONE active (pending or approved) testimonial per shop
CREATE UNIQUE INDEX testimonials_one_active_per_shop
  ON public.testimonials(shop_id)
  WHERE status IN ('pending','approved');

CREATE INDEX testimonials_public_idx
  ON public.testimonials(featured, created_at DESC)
  WHERE status = 'approved' AND featured = true AND display_publicly = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT SELECT ON public.testimonials TO anon;
GRANT ALL ON public.testimonials TO service_role;

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Public (anon + authenticated) can read only approved+featured+public rows
CREATE POLICY "testimonials_public_read"
  ON public.testimonials
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved' AND featured = true AND display_publicly = true);

-- Shop owners can read their own testimonials (all statuses)
CREATE POLICY "testimonials_owner_read"
  ON public.testimonials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = testimonials.shop_id AND s.user_id = auth.uid())
  );

-- Shop owner can insert for their own shop; must be pending
CREATE POLICY "testimonials_owner_insert"
  ON public.testimonials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'pending'
    AND featured = false
    AND submitted_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = testimonials.shop_id AND s.user_id = auth.uid())
  );

-- Shop owner can update ONLY while pending, and cannot flip status/featured
CREATE POLICY "testimonials_owner_update_pending"
  ON public.testimonials
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = testimonials.shop_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    status = 'pending'
    AND featured = false
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = testimonials.shop_id AND s.user_id = auth.uid())
  );

-- Shop owner can delete their own pending testimonial
CREATE POLICY "testimonials_owner_delete_pending"
  ON public.testimonials
  FOR DELETE
  TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = testimonials.shop_id AND s.user_id = auth.uid())
  );

-- Admin full access
CREATE POLICY "testimonials_admin_all"
  ON public.testimonials
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================================================
-- LEGAL SETTINGS (singleton)
-- ==========================================================================
CREATE TABLE public.legal_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  company_name TEXT,
  trade_name TEXT,
  tax_id TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT,
  contact_email TEXT DEFAULT 'contact@garageflow.pt',
  contact_phone TEXT,
  website TEXT,
  share_capital TEXT,
  at_certified BOOLEAN NOT NULL DEFAULT false,
  at_certificate_number TEXT,
  privacy_policy TEXT,
  terms_of_service TEXT,
  footer_text TEXT,
  copyright_text TEXT,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  show_in_footer BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (singleton = true)
);

GRANT SELECT ON public.legal_settings TO anon, authenticated;
GRANT ALL ON public.legal_settings TO service_role;

ALTER TABLE public.legal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_settings_public_read"
  ON public.legal_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "legal_settings_admin_write"
  ON public.legal_settings
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_legal_settings_updated_at
  BEFORE UPDATE ON public.legal_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed empty singleton row so frontend can read defaults
INSERT INTO public.legal_settings (singleton, contact_email)
VALUES (true, 'contact@garageflow.pt')
ON CONFLICT (singleton) DO NOTHING;
