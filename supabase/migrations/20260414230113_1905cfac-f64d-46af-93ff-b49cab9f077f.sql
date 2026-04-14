
-- Trust score table for marketplace sellers
CREATE TABLE public.seller_trust_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_sales integer NOT NULL DEFAULT 0,
  successful_sales integer NOT NULL DEFAULT 0,
  disputed_sales integer NOT NULL DEFAULT 0,
  total_inspections integer NOT NULL DEFAULT 0,
  avg_rating numeric NOT NULL DEFAULT 0,
  trust_level text NOT NULL DEFAULT 'bronze',
  score_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_trust_scores ENABLE ROW LEVEL SECURITY;

-- Anyone can read trust scores (public reputation)
CREATE POLICY "Public read trust scores"
  ON public.seller_trust_scores FOR SELECT
  TO anon, authenticated
  USING (true);

-- Sellers can see their own (redundant with above but explicit)
CREATE POLICY "Users manage own trust score"
  ON public.seller_trust_scores FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Super admin full access
CREATE POLICY "Super admin manage trust scores"
  ON public.seller_trust_scores FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_seller_trust_scores_updated_at
  BEFORE UPDATE ON public.seller_trust_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to recalculate trust score for a seller
CREATE OR REPLACE FUNCTION public.recalculate_trust_score(_seller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total int;
  _successful int;
  _disputed int;
  _inspections int;
  _points int;
  _level text;
BEGIN
  -- Count escrow transactions
  SELECT 
    COUNT(*) FILTER (WHERE status IN ('released', 'delivery_confirmed', 'disputed', 'refunded')),
    COUNT(*) FILTER (WHERE status = 'released'),
    COUNT(*) FILTER (WHERE status IN ('disputed', 'refunded'))
  INTO _total, _successful, _disputed
  FROM public.market_escrow
  WHERE seller_id = _seller_id;

  -- Count inspections completed
  SELECT COUNT(*) INTO _inspections
  FROM public.carity_inspections ci
  JOIN public.carity_listings cl ON cl.id = ci.listing_id
  WHERE cl.seller_id = _seller_id AND ci.status = 'completed';

  -- Calculate points: +10 per successful sale, -20 per dispute, +5 per inspection
  _points := (_successful * 10) - (_disputed * 20) + (_inspections * 5);
  IF _points < 0 THEN _points := 0; END IF;

  -- Determine trust level
  IF _points >= 100 THEN _level := 'platinum';
  ELSIF _points >= 50 THEN _level := 'gold';
  ELSIF _points >= 20 THEN _level := 'silver';
  ELSE _level := 'bronze';
  END IF;

  -- Upsert
  INSERT INTO public.seller_trust_scores (user_id, total_sales, successful_sales, disputed_sales, total_inspections, score_points, trust_level)
  VALUES (_seller_id, _total, _successful, _disputed, _inspections, _points, _level)
  ON CONFLICT (user_id) DO UPDATE SET
    total_sales = EXCLUDED.total_sales,
    successful_sales = EXCLUDED.successful_sales,
    disputed_sales = EXCLUDED.disputed_sales,
    total_inspections = EXCLUDED.total_inspections,
    score_points = EXCLUDED.score_points,
    trust_level = EXCLUDED.trust_level;
END;
$$;
