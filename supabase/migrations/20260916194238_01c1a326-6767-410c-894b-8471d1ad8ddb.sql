CREATE OR REPLACE FUNCTION public.tg_notify_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _client_name text;
  _conv text;
  _preview text;
  _who text;
BEGIN
  _conv := COALESCE(NEW.client_id::text, 'team');

  -- Evita inundar: só uma notificação por ler por conversa.
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.shop_id = NEW.shop_id
      AND n.read = false
      AND n.archived_at IS NULL
      AND n.data->>'event' = 'chat_message'
      AND n.data->>'conversation' = _conv
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id IS NOT NULL THEN
    SELECT c.name INTO _client_name FROM public.clients c WHERE c.id = NEW.client_id;
    _who := COALESCE(_client_name, 'Cliente');
  ELSE
    _who := 'Equipa';
  END IF;

  _preview := left(regexp_replace(COALESCE(NEW.message, ''), '\s+', ' ', 'g'), 120);

  INSERT INTO public.notifications (shop_id, type, title, message, link, data)
  VALUES (
    NEW.shop_id,
    'info',
    'Nova mensagem',
    _who || ': ' || _preview,
    '/chat',
    jsonb_build_object(
      'event', 'chat_message',
      'conversation', _conv,
      'client_id', NEW.client_id,
      'sender_id', NEW.sender_id,
      'sender_type', NEW.sender_type,
      'message_id', NEW.id
    )
  );

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS tg_notify_chat_message_trg ON public.chat_messages;
CREATE TRIGGER tg_notify_chat_message_trg
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_chat_message();