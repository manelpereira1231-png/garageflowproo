
-- Shops table
CREATE TABLE public.shops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'Portugal',
  currency TEXT NOT NULL DEFAULT 'EUR',
  vat_rate NUMERIC NOT NULL DEFAULT 23,
  labor_rate NUMERIC NOT NULL DEFAULT 35,
  language TEXT NOT NULL DEFAULT 'pt',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own shop" ON public.shops FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  company TEXT,
  nif TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop owners manage clients" ON public.clients FOR ALL
  USING (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()));

-- Vehicles table
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL DEFAULT 2024,
  plate TEXT NOT NULL,
  vin TEXT,
  mileage INTEGER NOT NULL DEFAULT 0,
  fuel TEXT NOT NULL DEFAULT 'Gasolina',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop owners manage vehicles" ON public.vehicles FOR ALL
  USING (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()));

-- Quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_date DATE NOT NULL DEFAULT (CURRENT_DATE + 30),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_total NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  cost_total NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop owners manage quotes" ON public.quotes FOR ALL
  USING (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()));

-- Work Orders table
CREATE TABLE public.work_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'manual',
  quote_id UUID REFERENCES public.quotes(id),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  entry_mileage INTEGER NOT NULL DEFAULT 0,
  client_description TEXT,
  diagnosis TEXT,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  labor_hours NUMERIC NOT NULL DEFAULT 0,
  technician TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_total NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  cost_total NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop owners manage work_orders" ON public.work_orders FOR ALL
  USING (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid()));

-- Auto-create shop on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.shops (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), COALESCE(NEW.email, ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
