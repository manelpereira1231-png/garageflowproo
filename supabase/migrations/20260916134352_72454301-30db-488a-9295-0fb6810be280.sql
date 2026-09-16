CREATE OR REPLACE FUNCTION public.admin_set_gsn_supplier_approval(
  _supplier_id uuid,
  _approved boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_owner_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT lower(nullif(trim(email), '')), owner_user_id
  INTO v_email, v_owner_user_id
  FROM public.gsn_suppliers
  WHERE id = _supplier_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'supplier not found';
  END IF;

  UPDATE public.gsn_suppliers
  SET approved = _approved,
      active = CASE WHEN _approved THEN true ELSE active END,
      state = CASE WHEN _approved THEN 'approved'::public.gsn_supplier_state ELSE 'pending_approval'::public.gsn_supplier_state END,
      approved_at = CASE WHEN _approved THEN COALESCE(approved_at, now()) ELSE NULL END,
      approved_by = CASE WHEN _approved THEN auth.uid() ELSE NULL END,
      updated_at = now()
  WHERE deleted_at IS NULL
    AND (
      id = _supplier_id
      OR (v_owner_user_id IS NOT NULL AND owner_user_id = v_owner_user_id)
      OR (v_email IS NOT NULL AND lower(nullif(trim(email), '')) = v_email)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_gsn_supplier_approval(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_gsn_supplier_approval(uuid, boolean) TO authenticated;

ALTER TABLE public.gsn_suppliers DISABLE TRIGGER trg_gsn_supplier_privilege;
UPDATE public.gsn_suppliers
SET approved = true,
    active = true,
    state = 'approved',
    approved_at = COALESCE(approved_at, now()),
    approved_by = COALESCE(approved_by, 'c9271bb4-2845-49b3-967d-45ad7e577148'::uuid),
    updated_at = now()
WHERE deleted_at IS NULL
  AND lower(email) = lower('gergina9638@uorak.com');
ALTER TABLE public.gsn_suppliers ENABLE TRIGGER trg_gsn_supplier_privilege;