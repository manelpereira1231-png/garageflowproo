ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_work_order_cancellation_reason()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled' THEN
    IF COALESCE(OLD.status, '') = 'open'
       AND (NEW.cancellation_reason IS NULL OR length(btrim(NEW.cancellation_reason)) < 5) THEN
      RAISE EXCEPTION 'cancellation_reason_required'
        USING HINT = 'Indique o motivo do cancelamento (mínimo 5 caracteres).';
    END IF;
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_work_order_cancellation_reason_trg ON public.work_orders;
CREATE TRIGGER enforce_work_order_cancellation_reason_trg
BEFORE UPDATE ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_work_order_cancellation_reason();