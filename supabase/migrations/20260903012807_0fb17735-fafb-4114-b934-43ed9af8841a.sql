CREATE OR REPLACE FUNCTION public.tg_notify_quote_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _client_name text;
  _vehicle_label text;
  _plate text;
  _amount text;
  _event text;
  _title text;
  _verb text;
  _ntype text;
BEGIN
  IF NEW.status IN ('approved','converted') AND OLD.status NOT IN ('approved','converted') THEN
    _event := 'quote_approved'; _title := 'Orçamento aprovado'; _verb := ' aprovou o orçamento '; _ntype := 'success';
  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    _event := 'quote_rejected'; _title := 'Orçamento rejeitado'; _verb := ' rejeitou o orçamento '; _ntype := 'warning';
  ELSE
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.shop_id = NEW.shop_id
      AND n.data->>'event' = _event
      AND n.data->>'quote_id' = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.name INTO _client_name FROM public.clients c WHERE c.id = NEW.client_id;
  SELECT trim(concat_ws(' ', v.make, v.model)), v.plate INTO _vehicle_label, _plate
  FROM public.vehicles v WHERE v.id = NEW.vehicle_id;
  _amount := trim(to_char(COALESCE(NEW.total, 0), 'FM999G999G999G990D00'));

  INSERT INTO public.notifications (shop_id, type, title, message, link, data)
  VALUES (
    NEW.shop_id, _ntype, _title,
    concat(
      'O cliente ', COALESCE(_client_name, 'Cliente'), _verb, COALESCE(NEW.number, ''),
      CASE WHEN _vehicle_label IS NOT NULL AND _vehicle_label <> '' THEN ' — ' || _vehicle_label ELSE '' END,
      CASE WHEN _plate IS NOT NULL AND _plate <> '' THEN ' (' || _plate || ')' ELSE '' END,
      ' · ', _amount,
      CASE WHEN _event = 'quote_rejected' AND COALESCE(NEW.client_notes,'') <> ''
           THEN ' · Motivo: ' || NEW.client_notes ELSE '' END
    ),
    '/quotes?search=' || replace(COALESCE(NEW.number, ''), ' ', '%20'),
    jsonb_build_object(
      'event', _event,
      'quote_id', NEW.id,
      'quote_number', NEW.number,
      'client_id', NEW.client_id,
      'client_name', _client_name,
      'vehicle_id', NEW.vehicle_id,
      'vehicle', _vehicle_label,
      'plate', _plate,
      'total', NEW.total,
      'status', NEW.status,
      'client_notes', NEW.client_notes,
      'decided_at', now()
    )
  );

  RETURN NEW;
END;
$fn$;

UPDATE public.notifications
SET link = '/quotes?search=' || replace(data->>'quote_number', ' ', '%20')
WHERE data->>'quote_number' IS NOT NULL
  AND data->>'event' IN ('quote_approved', 'quote_rejected');