
-- Add missing columns to shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS nif text DEFAULT '';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS address text DEFAULT '';

-- Create storage bucket for shop logos
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-logos', 'shop-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for logo bucket: anyone can view, authenticated users can upload/update their own
CREATE POLICY "Public can view logos" ON storage.objects FOR SELECT USING (bucket_id = 'shop-logos');
CREATE POLICY "Authenticated users upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shop-logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'shop-logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users delete logos" ON storage.objects FOR DELETE USING (bucket_id = 'shop-logos' AND auth.uid() IS NOT NULL);

-- Fix the subscription trigger to set trial_end to 30 days
CREATE OR REPLACE FUNCTION public.handle_new_shop_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.subscriptions (shop_id, plan, status, trial_end)
  VALUES (NEW.id, 'free', 'active', now() + interval '30 days');
  
  INSERT INTO public.shop_users (shop_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner');
  
  RETURN NEW;
END;
$function$;

-- Re-create the trigger
DROP TRIGGER IF EXISTS on_shop_created ON public.shops;
CREATE TRIGGER on_shop_created
  AFTER INSERT ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_shop_subscription();
