CREATE OR REPLACE FUNCTION public.partner_referral_is_valid(_partner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partners
    WHERE id = _partner_id AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.partner_referral_is_valid(uuid) TO anon, authenticated;