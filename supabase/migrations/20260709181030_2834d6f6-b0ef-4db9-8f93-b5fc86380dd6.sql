
CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  shop_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  city text,
  employees text,
  current_software text,
  best_contact_time text,
  notes text,
  status text NOT NULL DEFAULT 'new',
  source text DEFAULT 'public_demo_page',
  ip_address text,
  user_agent text,
  contacted_at timestamptz,
  scheduled_at timestamptz,
  converted_at timestamptz,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_requests TO authenticated;
GRANT INSERT ON public.demo_requests TO anon;
GRANT ALL ON public.demo_requests TO service_role;

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) may submit a demo request
CREATE POLICY "Anyone can submit demo requests"
  ON public.demo_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Super admins can do everything
CREATE POLICY "Super admins manage demo requests"
  ON public.demo_requests
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Commercial team (contact@garageflow.pt) can view/update
CREATE POLICY "Commercial can view demo requests"
  ON public.demo_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (auth.jwt() ->> 'email') = 'contact@garageflow.pt'
  );

CREATE POLICY "Commercial can update demo requests"
  ON public.demo_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (auth.jwt() ->> 'email') = 'contact@garageflow.pt'
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (auth.jwt() ->> 'email') = 'contact@garageflow.pt'
  );

CREATE INDEX idx_demo_requests_status ON public.demo_requests(status);
CREATE INDEX idx_demo_requests_created ON public.demo_requests(created_at DESC);

CREATE TRIGGER trg_demo_requests_updated_at
  BEFORE UPDATE ON public.demo_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.demo_requests;
