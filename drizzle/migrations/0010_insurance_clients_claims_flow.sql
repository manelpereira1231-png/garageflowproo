CREATE TABLE IF NOT EXISTS public.insurer_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  legal_name text,
  code text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.insurer_catalog TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.insurer_catalog TO authenticated;
GRANT ALL ON public.insurer_catalog TO service_role;
ALTER TABLE public.insurer_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY insurer_catalog_read ON public.insurer_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY insurer_catalog_admin_ins ON public.insurer_catalog FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY insurer_catalog_admin_upd ON public.insurer_catalog FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY insurer_catalog_admin_del ON public.insurer_catalog FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

ALTER TABLE public.insurers ADD COLUMN IF NOT EXISTS catalog_id uuid REFERENCES public.insurer_catalog(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS insurers_shop_catalog_uniq ON public.insurers(shop_id, catalog_id) WHERE catalog_id IS NOT NULL;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS insurance_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS ref text,
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount_initial_quote numeric,
  ADD COLUMN IF NOT EXISTS amount_expert numeric,
  ADD COLUMN IF NOT EXISTS amount_invoiced numeric,
  ADD COLUMN IF NOT EXISTS amount_paid_insurer numeric,
  ADD COLUMN IF NOT EXISTS amount_client numeric,
  ADD COLUMN IF NOT EXISTS amount_pending numeric,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

WITH n AS (SELECT id, row_number() OVER (PARTITION BY shop_id ORDER BY created_at) rn FROM public.claims WHERE ref IS NULL)
UPDATE public.claims c SET ref = 'SIN-' || lpad(n.rn::text, 4, '0') FROM n WHERE n.id = c.id;
CREATE UNIQUE INDEX IF NOT EXISTS claims_shop_ref_uniq ON public.claims(shop_id, ref);

CREATE OR REPLACE FUNCTION public.ensure_shop_insurer(_shop_id uuid, _catalog_id uuid, _name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_name text;
BEGIN
  IF NOT (_shop_id IN (SELECT get_user_shop_ids(auth.uid())) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _catalog_id IS NOT NULL THEN
    SELECT id INTO v_id FROM insurers WHERE shop_id = _shop_id AND catalog_id = _catalog_id;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
    SELECT name INTO v_name FROM insurer_catalog WHERE id = _catalog_id;
    IF v_name IS NULL THEN RAISE EXCEPTION 'catalog_not_found'; END IF;
    SELECT id INTO v_id FROM insurers WHERE shop_id = _shop_id AND lower(name) = lower(v_name) LIMIT 1;
    IF v_id IS NOT NULL THEN
      UPDATE insurers SET catalog_id = _catalog_id WHERE id = v_id;
      RETURN v_id;
    END IF;
    INSERT INTO insurers(shop_id, name, catalog_id, active) VALUES (_shop_id, v_name, _catalog_id, true) RETURNING id INTO v_id;
    RETURN v_id;
  END IF;
  v_name := nullif(trim(_name), '');
  IF v_name IS NULL THEN RAISE EXCEPTION 'name_required'; END IF;
  SELECT id INTO v_id FROM insurers WHERE shop_id = _shop_id AND lower(name) = lower(v_name) LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO insurers(shop_id, name, active) VALUES (_shop_id, v_name, true) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_shop_insurer(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_claim_ref()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n int;
BEGIN
  IF NEW.ref IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('claim_ref_' || NEW.shop_id::text));
    SELECT COALESCE(MAX(NULLIF(regexp_replace(ref, '\D', '', 'g'), '')::int), 0) + 1 INTO v_n FROM claims WHERE shop_id = NEW.shop_id;
    NEW.ref := 'SIN-' || lpad(v_n::text, 4, '0');
  END IF;
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_claim_ref ON public.claims;
CREATE TRIGGER trg_claim_ref BEFORE INSERT ON public.claims FOR EACH ROW EXECUTE FUNCTION public.tg_claim_ref();

CREATE OR REPLACE FUNCTION public.tg_claim_track()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE u uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.claim_events (shop_id, claim_id, kind, description, created_by)
    VALUES (NEW.shop_id, NEW.id, 'created', 'Sinistro criado', COALESCE(NEW.created_by, u));
  ELSE
    NEW.updated_at := now();
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.claim_events (shop_id, claim_id, kind, description, meta, created_by)
      VALUES (NEW.shop_id, NEW.id, 'status', 'Estado alterado para ' || NEW.status,
              jsonb_build_object('from', OLD.status, 'to', NEW.status), u);
      IF NEW.status IN ('done','cancelled') AND NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
      IF NEW.status NOT IN ('done','cancelled') THEN NEW.closed_at := NULL; END IF;
    END IF;
    IF NEW.expert_status IS DISTINCT FROM OLD.expert_status THEN
      INSERT INTO public.claim_events (shop_id, claim_id, kind, description, meta, created_by)
      VALUES (NEW.shop_id, NEW.id, 'expert', 'Peritagem: ' || NEW.expert_status,
              jsonb_build_object('from', OLD.expert_status, 'to', NEW.expert_status), u);
    END IF;
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      INSERT INTO public.claim_events (shop_id, claim_id, kind, description, meta, created_by)
      VALUES (NEW.shop_id, NEW.id, 'approval', 'Autorização: ' || NEW.approval_status,
              jsonb_build_object('from', OLD.approval_status, 'to', NEW.approval_status), u);
    END IF;
    IF NEW.claim_number IS DISTINCT FROM OLD.claim_number AND NEW.claim_number IS NOT NULL THEN
      INSERT INTO public.claim_events (shop_id, claim_id, kind, description, created_by)
      VALUES (NEW.shop_id, NEW.id, 'data', 'Número de processo: ' || NEW.claim_number, u);
    END IF;
    IF NEW.quote_id IS DISTINCT FROM OLD.quote_id AND NEW.quote_id IS NOT NULL THEN
      INSERT INTO public.claim_events (shop_id, claim_id, kind, description, created_by)
      VALUES (NEW.shop_id, NEW.id, 'link', 'Orçamento associado', u);
    END IF;
    IF NEW.work_order_id IS DISTINCT FROM OLD.work_order_id AND NEW.work_order_id IS NOT NULL THEN
      INSERT INTO public.claim_events (shop_id, claim_id, kind, description, created_by)
      VALUES (NEW.shop_id, NEW.id, 'link', 'Ordem de serviço associada', u);
    END IF;
    IF NEW.invoice_id IS DISTINCT FROM OLD.invoice_id AND NEW.invoice_id IS NOT NULL THEN
      INSERT INTO public.claim_events (shop_id, claim_id, kind, description, created_by)
      VALUES (NEW.shop_id, NEW.id, 'link', 'Fatura associada', u);
    END IF;
  END IF;

  IF NEW.next_action_date IS NOT NULL
     AND NEW.status NOT IN ('done', 'cancelled')
     AND (TG_OP = 'INSERT' OR NEW.next_action_date IS DISTINCT FROM OLD.next_action_date
          OR NEW.next_action IS DISTINCT FROM OLD.next_action) THEN
    DELETE FROM public.alerts
      WHERE shop_id = NEW.shop_id AND type = 'claim_follow_up'
        AND message LIKE '%' || NEW.id::text || '%' AND status <> 'resolved';
    INSERT INTO public.alerts (shop_id, vehicle_id, client_id, type, title, message, due_date, status, priority)
    VALUES (NEW.shop_id, NEW.vehicle_id, NEW.client_id, 'claim_follow_up',
            'Sinistro: próxima ação',
            COALESCE(NEW.next_action, 'Acompanhar processo de seguradora') || ' [' || NEW.id::text || ']',
            NEW.next_action_date, 'pending', 'medium');
  END IF;
  RETURN NEW;
END;
$function$;