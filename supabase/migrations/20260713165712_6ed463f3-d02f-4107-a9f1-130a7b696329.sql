CREATE OR REPLACE FUNCTION public.tg_notify_quote_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_name text;
  _vehicle_label text;
  _plate text;
  _amount text;
BEGIN
  -- Only notify once when a quote first enters an approved/final approved state.
  IF NEW.status NOT IN ('approved', 'converted') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('approved', 'converted') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.shop_id = NEW.shop_id
      AND n.type = 'success'
      AND n.data->>'event' = 'quote_approved'
      AND n.data->>'quote_id' = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.name INTO _client_name
  FROM public.clients c
  WHERE c.id = NEW.client_id;

  SELECT trim(concat_ws(' ', v.make, v.model)), v.plate
  INTO _vehicle_label, _plate
  FROM public.vehicles v
  WHERE v.id = NEW.vehicle_id;

  _amount := trim(to_char(COALESCE(NEW.total, 0), 'FM999G999G999G990D00'));

  INSERT INTO public.notifications (shop_id, type, title, message, link, data)
  VALUES (
    NEW.shop_id,
    'success',
    'Orçamento aprovado',
    concat(
      'O cliente ', COALESCE(_client_name, 'Cliente'),
      ' aprovou o orçamento ', COALESCE(NEW.number, ''),
      CASE WHEN _vehicle_label IS NOT NULL AND _vehicle_label <> '' THEN ' — ' || _vehicle_label ELSE '' END,
      CASE WHEN _plate IS NOT NULL AND _plate <> '' THEN ' (' || _plate || ')' ELSE '' END,
      ' · ', _amount
    ),
    '/quotes',
    jsonb_build_object(
      'event', 'quote_approved',
      'quote_id', NEW.id,
      'quote_number', NEW.number,
      'client_id', NEW.client_id,
      'client_name', _client_name,
      'vehicle_id', NEW.vehicle_id,
      'vehicle', _vehicle_label,
      'plate', _plate,
      'total', NEW.total,
      'status', NEW.status,
      'approved_at', COALESCE(NEW.signed_at, now())
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_quotes_notify_approval ON public.quotes;
CREATE TRIGGER tg_quotes_notify_approval
AFTER UPDATE OF status ON public.quotes
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.tg_notify_quote_approval();

GRANT EXECUTE ON FUNCTION public.tg_notify_quote_approval() TO service_role;