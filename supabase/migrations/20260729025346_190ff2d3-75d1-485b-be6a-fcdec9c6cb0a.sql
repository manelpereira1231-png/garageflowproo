UPDATE public.plan_country_prices SET amount =  49.00 WHERE country_code IN ('FR','DE','ES') AND plan_slug='pro'    AND cycle='monthly';
UPDATE public.plan_country_prices SET amount = 490.00 WHERE country_code IN ('FR','DE','ES') AND plan_slug='pro'    AND cycle='yearly';
UPDATE public.plan_country_prices SET amount =  99.00 WHERE country_code IN ('FR','DE','ES') AND plan_slug='garage' AND cycle='monthly';
UPDATE public.plan_country_prices SET amount = 990.00 WHERE country_code IN ('FR','DE','ES') AND plan_slug='garage' AND cycle='yearly';