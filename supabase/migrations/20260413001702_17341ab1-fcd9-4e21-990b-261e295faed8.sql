
-- Carity Seller Profiles
CREATE TABLE public.carity_seller_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.carity_seller_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage own profile" ON public.carity_seller_profiles
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admin manage seller profiles" ON public.carity_seller_profiles
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Public read verified sellers" ON public.carity_seller_profiles
  FOR SELECT USING (verified = true);

-- Carity Listings
CREATE TABLE public.carity_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  shop_id uuid REFERENCES public.shops(id),
  make text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  year integer NOT NULL DEFAULT 2020,
  mileage integer NOT NULL DEFAULT 0,
  fuel text NOT NULL DEFAULT 'Gasóleo',
  plate text NOT NULL DEFAULT '',
  vin text,
  price numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending_payment',
  commission_rate numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  sold_at timestamptz
);

ALTER TABLE public.carity_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage own listings" ON public.carity_listings
  FOR ALL USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Public read published listings" ON public.carity_listings
  FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE POLICY "Shop members view assigned listings" ON public.carity_listings
  FOR SELECT USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())));

CREATE POLICY "Super admin manage listings" ON public.carity_listings
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX idx_carity_listings_status ON public.carity_listings(status);
CREATE INDEX idx_carity_listings_seller ON public.carity_listings(seller_id);

-- Carity Inspections
CREATE TABLE public.carity_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.carity_listings(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  status text NOT NULL DEFAULT 'pending',
  payment_status text NOT NULL DEFAULT 'pending',
  payment_amount numeric NOT NULL DEFAULT 19.90,
  shop_share numeric NOT NULL DEFAULT 5.97,
  platform_share numeric NOT NULL DEFAULT 13.93,
  stripe_session_id text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  notes text
);

ALTER TABLE public.carity_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers view own inspections" ON public.carity_inspections
  FOR SELECT USING (listing_id IN (SELECT id FROM public.carity_listings WHERE seller_id = auth.uid()));

CREATE POLICY "Shop members manage assigned inspections" ON public.carity_inspections
  FOR ALL USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())))
  WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())));

CREATE POLICY "Super admin manage inspections" ON public.carity_inspections
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Carity Inspection Reports
CREATE TABLE public.carity_inspection_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.carity_inspections(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.carity_listings(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  engine_status text NOT NULL DEFAULT 'ok',
  transmission_status text NOT NULL DEFAULT 'ok',
  brakes_status text NOT NULL DEFAULT 'ok',
  suspension_status text NOT NULL DEFAULT 'ok',
  steering_status text NOT NULL DEFAULT 'ok',
  tires_status text NOT NULL DEFAULT 'ok',
  electrical_status text NOT NULL DEFAULT 'ok',
  exterior_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  interior_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  engine_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  tire_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  damage_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  defects jsonb NOT NULL DEFAULT '[]'::jsonb,
  overall_score numeric NOT NULL DEFAULT 0,
  recommendation text NOT NULL DEFAULT 'pending',
  inspector_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.carity_inspection_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read reports of published listings" ON public.carity_inspection_reports
  FOR SELECT TO anon, authenticated USING (
    listing_id IN (SELECT id FROM public.carity_listings WHERE status = 'published')
  );

CREATE POLICY "Shop members manage own reports" ON public.carity_inspection_reports
  FOR ALL USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())))
  WITH CHECK (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())));

CREATE POLICY "Sellers view own car reports" ON public.carity_inspection_reports
  FOR SELECT USING (listing_id IN (SELECT id FROM public.carity_listings WHERE seller_id = auth.uid()));

CREATE POLICY "Super admin manage reports" ON public.carity_inspection_reports
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Carity Transactions (financial tracking)
CREATE TABLE public.carity_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.carity_listings(id),
  inspection_id uuid REFERENCES public.carity_inspections(id),
  shop_id uuid REFERENCES public.shops(id),
  type text NOT NULL DEFAULT 'inspection_fee',
  amount numeric NOT NULL DEFAULT 0,
  platform_amount numeric NOT NULL DEFAULT 0,
  shop_amount numeric NOT NULL DEFAULT 0,
  stripe_payment_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.carity_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members view own transactions" ON public.carity_transactions
  FOR SELECT USING (shop_id IN (SELECT public.get_user_shop_ids(auth.uid())));

CREATE POLICY "Super admin manage transactions" ON public.carity_transactions
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Storage bucket for Carity photos
INSERT INTO storage.buckets (id, name, public) VALUES ('carity-photos', 'carity-photos', true);

CREATE POLICY "Anyone can view carity photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'carity-photos');

CREATE POLICY "Authenticated users upload carity photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'carity-photos');

CREATE POLICY "Users manage own carity photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'carity-photos');

CREATE POLICY "Users delete own carity photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'carity-photos');
