DO $$
DECLARE v timestamptz;
BEGIN
  CREATE TEMP TABLE _trg_check(id int, updated_at timestamptz) ON COMMIT DROP;
  CREATE TRIGGER _t BEFORE INSERT OR UPDATE ON _trg_check FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  GRANT SELECT, INSERT ON _trg_check TO authenticated;
  SET LOCAL ROLE authenticated;
  INSERT INTO _trg_check(id, updated_at) VALUES (1, NULL) RETURNING updated_at INTO v;
  RESET ROLE;
  IF v IS NULL THEN
    RAISE EXCEPTION 'TRIGGER_CHECK_FAILED: trigger did not run as authenticated';
  END IF;
  RAISE NOTICE 'TRIGGER_CHECK_OK %', v;
END $$;