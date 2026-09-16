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
  ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    _event := 'quote_cancelled'; _title := 'Orçamento cancelado'; _ntype := 'warning';
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
  _amount := trim(to_char(COALESCE(NEW.total, 0), 'FM999G999G999G990D00')) || ' €';

  INSERT INTO public.notifications (shop_id, type, title, message, link, data)
  VALUES (
    NEW.shop_id, _ntype, _title,
    concat(
      CASE WHEN _event = 'quote_cancelled'
           THEN 'O orçamento ' || COALESCE(NEW.number, '') || ' foi cancelado pela oficina'
           ELSE 'O cliente ' || COALESCE(_client_name, 'Cliente') || _verb || COALESCE(NEW.number, '')
      END,
      CASE WHEN _vehicle_label IS NOT NULL AND _vehicle_label <> '' THEN ' — ' || _vehicle_label ELSE '' END,
      CASE WHEN _plate IS NOT NULL AND _plate <> '' THEN ' (' || _plate || ')' ELSE '' END,
      ' · ', _amount,
      CASE WHEN _event = 'quote_rejected' AND COALESCE(NEW.client_notes,'') <> ''
           THEN ' · Motivo: ' || NEW.client_notes
           WHEN _event = 'quote_cancelled' AND COALESCE(NEW.cancellation_reason,'') <> ''
           THEN ' · Motivo: ' || NEW.cancellation_reason
           ELSE '' END
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
      'cancellation_reason', NEW.cancellation_reason,
      'decided_at', now()
    )
  );

  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tg_notify_work_order_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  _client_name text;
  _vehicle_label text;
  _plate text;
  _amount text;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status IS NOT DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.shop_id = NEW.shop_id
      AND n.data->>'event' = 'work_order_cancelled'
      AND n.data->>'work_order_id' = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.name INTO _client_name FROM public.clients c WHERE c.id = NEW.client_id;
  SELECT trim(concat_ws(' ', v.make, v.model)), v.plate INTO _vehicle_label, _plate
  FROM public.vehicles v WHERE v.id = NEW.vehicle_id;
  _amount := trim(to_char(COALESCE(NEW.total, 0), 'FM999G999G999G990D00')) || ' €';

  INSERT INTO public.notifications (shop_id, type, title, message, link, data)
  VALUES (
    NEW.shop_id, 'warning', 'Serviço cancelado',
    concat(
      'O serviço ', COALESCE(NEW.number, ''), ' foi cancelado',
      CASE WHEN _client_name IS NOT NULL THEN ' — ' || _client_name ELSE '' END,
      CASE WHEN _vehicle_label IS NOT NULL AND _vehicle_label <> '' THEN ' · ' || _vehicle_label ELSE '' END,
      CASE WHEN _plate IS NOT NULL AND _plate <> '' THEN ' (' || _plate || ')' ELSE '' END,
      ' · ', _amount,
      CASE WHEN COALESCE(NEW.cancellation_reason,'') <> '' THEN ' · Motivo: ' || NEW.cancellation_reason ELSE '' END
    ),
    '/services?search=' || replace(COALESCE(NEW.number, ''), ' ', '%20'),
    jsonb_build_object(
      'event', 'work_order_cancelled',
      'work_order_id', NEW.id,
      'work_order_number', NEW.number,
      'client_id', NEW.client_id,
      'client_name', _client_name,
      'vehicle_id', NEW.vehicle_id,
      'vehicle', _vehicle_label,
      'plate', _plate,
      'total', NEW.total,
      'cancellation_reason', NEW.cancellation_reason,
      'cancelled_at', now()
    )
  );

  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  r RECORD;
  _amt text;
  _msg text;
BEGIN
  FOR r IN
    SELECT id, message, data
      FROM public.notifications
     WHERE data->>'event' IN ('work_order_cancelled','quote_approved','quote_rejected','quote_cancelled')
       AND (data->>'total') IS NOT NULL
       AND message NOT ILIKE '%€%'
  LOOP
    _amt := trim(to_char(COALESCE((r.data->>'total')::numeric, 0), 'FM999G999G999G990D00'));
    _msg := r.message;
    IF _amt <> '' AND position(_amt in _msg) > 0 AND position(_amt || ' €' in _msg) = 0 THEN
      _msg := replace(_msg, _amt, _amt || ' €');
      UPDATE public.notifications SET message = _msg WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;