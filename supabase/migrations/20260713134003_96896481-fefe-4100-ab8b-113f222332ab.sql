GRANT SELECT ON public.platform_settings TO anon;
CREATE POLICY "Anon read public landing setting" ON public.platform_settings FOR SELECT TO anon USING (key IN ('landing','pricing'));