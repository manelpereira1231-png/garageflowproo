
-- 1. Tornar gatable os módulos antes considerados core
UPDATE public.features
   SET is_core = false
 WHERE slug IN ('clients','vehicles','services','invoices');

-- Mantém core: dashboard, settings, billing, support, quotes
-- (quotes fica core para o Free poder criar até ao limite; o limite mensal é
-- aplicado via platform_settings + verificação na criação).

-- 2. Aperta matriz Free: apenas dashboard + quotes + alerts_basic + core
UPDATE public.plan_features
   SET enabled = false
 WHERE plan_slug = 'free'
   AND feature_slug IN (
     'clients','vehicles','services','invoices','service_catalog',
     'workshop_mode','quote_approval','referrals','agenda','inspections',
     'chat','marketing','automations','loyalty','stock','warranties',
     'team_management','api','multi_shop','financial_reports_basic',
     'financial_reports_advanced','csv_export','public_booking','client_portal'
   );

UPDATE public.plan_features
   SET enabled = true
 WHERE plan_slug = 'free'
   AND feature_slug IN ('dashboard','quotes','alerts_basic','settings','billing','support');

-- 3. Pro e Garage continuam com tudo razoável: garantir que Pro tem clients/vehicles/services/invoices/catalog ligados
UPDATE public.plan_features
   SET enabled = true
 WHERE plan_slug IN ('pro','garage')
   AND feature_slug IN (
     'clients','vehicles','services','invoices','service_catalog',
     'workshop_mode','quote_approval','agenda','inspections','alerts_basic',
     'financial_reports_basic','referrals','warranties'
   );
