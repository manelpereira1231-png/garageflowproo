DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('has_role','prevent_duplicate_quote_work_order','protect_shop_billing_columns',
                        'check_trial_eligibility','get_shop_creation_status','is_commercial_admin')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('prevent_duplicate_quote_work_order','protect_shop_billing_columns')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
  END LOOP;
END $$;