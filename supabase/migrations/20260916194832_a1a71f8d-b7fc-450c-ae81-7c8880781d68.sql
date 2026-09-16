ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS recipient_id uuid;

CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient ON public.chat_messages(shop_id, recipient_id, sender_id, created_at);

-- Mensagens privadas entre dois membros só são visíveis a esses dois.
DROP POLICY IF EXISTS "chat_messages_private_select" ON public.chat_messages;
CREATE POLICY "chat_messages_private_select" ON public.chat_messages
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (recipient_id IS NULL OR recipient_id = auth.uid() OR sender_id = auth.uid());

DROP POLICY IF EXISTS "chat_messages_private_update" ON public.chat_messages;
CREATE POLICY "chat_messages_private_update" ON public.chat_messages
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (recipient_id IS NULL OR recipient_id = auth.uid() OR sender_id = auth.uid());

DROP POLICY IF EXISTS "chat_messages_private_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_private_insert" ON public.chat_messages
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (recipient_id IS NULL OR sender_id = auth.uid());

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
  _target uuid;
BEGIN
  IF NEW.recipient_id IS NOT NULL THEN
    _conv := 'dm:' || NEW.sender_id::text;
    _target := NEW.recipient_id;
  ELSE
    _conv := COALESCE(NEW.client_id::text, 'team');
    _target := NULL;
  END IF;

  -- Evita inundar: só uma notificação por ler por conversa.
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.shop_id = NEW.shop_id
      AND n.read = false
      AND n.archived_at IS NULL
      AND n.data->>'event' = 'chat_message'
      AND n.data->>'conversation' = _conv
      AND (_target IS NULL OR n.user_id = _target)
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.recipient_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(trim(p.name), ''), 'Equipa') INTO _who
    FROM public.shop_user_profiles p WHERE p.user_id = NEW.sender_id LIMIT 1;
    _who := COALESCE(_who, 'Equipa');
  ELSIF NEW.client_id IS NOT NULL THEN
    SELECT c.name INTO _client_name FROM public.clients c WHERE c.id = NEW.client_id;
    _who := COALESCE(_client_name, 'Cliente');
  ELSE
    _who := 'Equipa';
  END IF;

  _preview := left(regexp_replace(COALESCE(NEW.message, ''), '\s+', ' ', 'g'), 120);

  INSERT INTO public.notifications (shop_id, user_id, type, title, message, link, data)
  VALUES (
    NEW.shop_id,
    _target,
    'info',
    'Nova mensagem',
    _who || ': ' || _preview,
    '/chat',
    jsonb_build_object(
      'event', 'chat_message',
      'conversation', _conv,
      'client_id', NEW.client_id,
      'sender_id', NEW.sender_id,
      'recipient_id', NEW.recipient_id,
      'sender_type', NEW.sender_type,
      'message_id', NEW.id
    )
  );

  RETURN NEW;
END;
$fn$;