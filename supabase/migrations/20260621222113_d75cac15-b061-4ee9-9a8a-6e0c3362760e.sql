
-- Message templates for customer communication (email/WhatsApp/SMS)
-- Stored as plain text + variables; UI never exposes HTML.
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  event_slug text NOT NULL,                 -- e.g. quote_created, service_done
  channel text NOT NULL DEFAULT 'email',    -- email | whatsapp | sms
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  auto_send boolean NOT NULL DEFAULT false,
  schedule_minutes integer NOT NULL DEFAULT 0,
  allowed_hours_start smallint NOT NULL DEFAULT 8,
  allowed_hours_end smallint NOT NULL DEFAULT 20,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, event_slug, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop members manage their templates"
  ON public.message_templates
  FOR ALL
  TO authenticated
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid())
    OR shop_id IN (SELECT shop_id FROM public.shop_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid())
    OR shop_id IN (SELECT shop_id FROM public.shop_users WHERE user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.touch_message_templates_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;$$;

DROP TRIGGER IF EXISTS trg_touch_message_templates ON public.message_templates;
CREATE TRIGGER trg_touch_message_templates
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_message_templates_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_templates;
