-- 1) Serializa e bloqueia criação duplicada de OS a partir do mesmo orçamento.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_quote_work_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Serializa concorrentes sobre o mesmo orçamento dentro da transação.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.quote_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.work_orders w
    WHERE w.quote_id = NEW.quote_id
      AND (TG_OP = 'INSERT' OR w.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_WORK_ORDER_FOR_QUOTE'
      USING HINT = 'Já existe uma Ordem de Serviço para este orçamento.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_quote_work_order_trg ON public.work_orders;
CREATE TRIGGER prevent_duplicate_quote_work_order_trg
BEFORE INSERT ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_quote_work_order();

CREATE INDEX IF NOT EXISTS idx_work_orders_quote_id
  ON public.work_orders (quote_id) WHERE quote_id IS NOT NULL;

-- 2) Estatísticas de serviços agregadas no servidor (RLS aplicada: SECURITY INVOKER).
CREATE OR REPLACE FUNCTION public.work_order_status_stats(_shop_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'counts', COALESCE((
      SELECT jsonb_object_agg(status, c)
      FROM (SELECT status, count(*) AS c FROM public.work_orders
            WHERE shop_id = _shop_id GROUP BY status) s
    ), '{}'::jsonb),
    'month_revenue', COALESCE((
      SELECT sum(total) FROM public.work_orders
      WHERE shop_id = _shop_id
        AND status IN ('completed','delivered')
        AND completed_at >= date_trunc('month', now())
    ), 0)
  );
$$;

GRANT EXECUTE ON FUNCTION public.work_order_status_stats(uuid) TO authenticated;