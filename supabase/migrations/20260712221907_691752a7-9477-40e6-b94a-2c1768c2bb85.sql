
CREATE OR REPLACE FUNCTION public.tg_auto_create_work_order_from_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_id uuid;
  _count int;
  _num text;
BEGIN
  -- Só age quando a transição é para 'approved'
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Idempotência: já existe OS ligada a este orçamento?
  SELECT id INTO _existing_id FROM public.work_orders WHERE quote_id = NEW.id LIMIT 1;
  IF _existing_id IS NOT NULL THEN
    UPDATE public.quotes SET status = 'converted' WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.client_id IS NULL OR NEW.vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Numeração sequencial (mesmo padrão da UI existente)
  SELECT COUNT(*) INTO _count FROM public.work_orders WHERE shop_id = NEW.shop_id;
  _num := 'SRV-' || lpad((_count + 1)::text, 4, '0');

  INSERT INTO public.work_orders (
    shop_id, number, origin, quote_id,
    client_id, vehicle_id, entry_mileage,
    lines, labor_hours, subtotal, vat_total, total,
    cost_total, profit, status, notes
  ) VALUES (
    NEW.shop_id, _num, 'quote', NEW.id,
    NEW.client_id, NEW.vehicle_id, 0,
    NEW.lines, COALESCE(NEW.labor_hours, 0),
    COALESCE(NEW.subtotal, 0), COALESCE(NEW.vat_total, 0), COALESCE(NEW.total, 0),
    COALESCE(NEW.cost_total, 0), COALESCE(NEW.profit, 0),
    'approved', NEW.notes
  );

  -- Marcar orçamento como convertido (mesma lógica da conversão manual)
  UPDATE public.quotes SET status = 'converted' WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_quotes_auto_create_work_order ON public.quotes;
CREATE TRIGGER tg_quotes_auto_create_work_order
AFTER UPDATE OF status ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.tg_auto_create_work_order_from_quote();
