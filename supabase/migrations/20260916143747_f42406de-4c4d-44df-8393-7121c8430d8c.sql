CREATE OR REPLACE FUNCTION public.tg_notify_work_order_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  _amount := trim(to_char(COALESCE(NEW.total, 0), 'FM999G999G999G990D00'));

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

DROP TRIGGER IF EXISTS tg_notify_work_order_cancelled_trg ON public.work_orders;
CREATE TRIGGER tg_notify_work_order_cancelled_trg
AFTER UPDATE OF status ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_work_order_cancelled();