
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, template_key)
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members read templates" ON public.email_templates
  FOR SELECT USING (public.user_is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Shop owners manage templates" ON public.email_templates
  FOR ALL USING (public.user_owns_shop(auth.uid(), shop_id))
  WITH CHECK (public.user_owns_shop(auth.uid(), shop_id));

CREATE TRIGGER trg_email_templates_updated
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.email_lifecycle_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL,
  template_key TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  UNIQUE (shop_id, template_key, entity_id)
);

ALTER TABLE public.email_lifecycle_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members read lifecycle log" ON public.email_lifecycle_log
  FOR SELECT USING (public.user_is_shop_member(auth.uid(), shop_id));

CREATE OR REPLACE FUNCTION public.seed_email_templates_for_shop(_shop_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.email_templates (shop_id, template_key, subject, html_body) VALUES
    (_shop_id, 'welcome', 'Bem-vindo à {{shop_name}}',
     '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;color:#222"><h1 style="color:#f59e0b">Olá {{client_name}}!</h1><p>Obrigado por escolher a <strong>{{shop_name}}</strong>. A sua conta de cliente está ativa.</p><p>Pode acompanhar orçamentos, marcar serviços e ver o histórico do veículo no portal.</p><p style="margin-top:24px;color:#666;font-size:12px">{{shop_name}}</p></div>'),
    (_shop_id, 'first_quote', 'O seu orçamento #{{quote_number}} está pronto',
     '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;color:#222"><h1 style="color:#f59e0b">Orçamento pronto</h1><p>Olá {{client_name}},</p><p>Preparámos o orçamento <strong>#{{quote_number}}</strong> no valor de <strong>{{total}}</strong>.</p><p>Reveja e aceite no portal de cliente.</p><p style="margin-top:24px;color:#666;font-size:12px">{{shop_name}}</p></div>'),
    (_shop_id, 'first_work_order', 'Trabalho iniciado no seu veículo',
     '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;color:#222"><h1 style="color:#f59e0b">A trabalhar no seu veículo</h1><p>Olá {{client_name}},</p><p>Iniciámos o serviço <strong>#{{wo_number}}</strong> no seu {{vehicle}}.</p><p>Manteremos atualizações sobre o progresso.</p><p style="margin-top:24px;color:#666;font-size:12px">{{shop_name}}</p></div>'),
    (_shop_id, 'invoice_created', 'Fatura #{{invoice_number}} disponível',
     '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;color:#222"><h1 style="color:#f59e0b">Fatura disponível</h1><p>Olá {{client_name}},</p><p>Foi emitida a fatura <strong>#{{invoice_number}}</strong> no valor de <strong>{{total}}</strong>.</p><p>Consulte o documento no portal de cliente.</p><p style="margin-top:24px;color:#666;font-size:12px">{{shop_name}} — Documento sem valor fiscal certificado pela AT.</p></div>')
  ON CONFLICT (shop_id, template_key) DO NOTHING;
END;
$$;

DO $$ DECLARE s RECORD; BEGIN
  FOR s IN SELECT id FROM public.shops LOOP
    PERFORM public.seed_email_templates_for_shop(s.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.tg_seed_email_templates()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_email_templates_for_shop(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shops_seed_email_templates
  AFTER INSERT ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.tg_seed_email_templates();
