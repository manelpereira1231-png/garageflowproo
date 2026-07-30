-- 1) Horas de mão-de-obra irrealistas em orçamentos
WITH r AS (
  SELECT q.id,
         COALESCE(s.labor_rate, 45)::numeric AS rate,
         q.labor_hours, q.subtotal, q.vat_total, q.cost_total
  FROM public.quotes q
  JOIN public.shops s ON s.id = q.shop_id
  WHERE q.labor_hours > 100
)
UPDATE public.quotes q
SET labor_hours = 3,
    subtotal = ROUND(r.subtotal - (r.labor_hours - 3) * r.rate, 2),
    vat_total = ROUND((r.subtotal - (r.labor_hours - 3) * r.rate) * 0.23, 2),
    total = ROUND((r.subtotal - (r.labor_hours - 3) * r.rate) * 1.23, 2),
    profit = ROUND(r.subtotal - (r.labor_hours - 3) * r.rate - COALESCE(r.cost_total, 0), 2)
FROM r WHERE q.id = r.id;

-- 2) Horas de mão-de-obra irrealistas em ordens de serviço
WITH r AS (
  SELECT w.id,
         COALESCE(s.labor_rate, 45)::numeric AS rate,
         w.labor_hours, w.subtotal, w.cost_total
  FROM public.work_orders w
  JOIN public.shops s ON s.id = w.shop_id
  WHERE w.labor_hours > 100
)
UPDATE public.work_orders w
SET labor_hours = 3,
    subtotal = ROUND(r.subtotal - (r.labor_hours - 3) * r.rate, 2),
    vat_total = ROUND((r.subtotal - (r.labor_hours - 3) * r.rate) * 0.23, 2),
    total = ROUND((r.subtotal - (r.labor_hours - 3) * r.rate) * 1.23, 2),
    profit = ROUND(r.subtotal - (r.labor_hours - 3) * r.rate - COALESCE(r.cost_total, 0), 2)
FROM r WHERE w.id = r.id;

-- 3) Orçamento com subtotal absurdo (44 milhões) — dados de teste
UPDATE public.quotes
SET subtotal = 444.44,
    vat_total = 102.22,
    total = 546.66,
    profit = ROUND(444.44 - COALESCE(cost_total, 0), 2)
WHERE subtotal > 1000000;

-- 4) Lucros incoerentes (maiores que o valor líquido)
UPDATE public.quotes SET profit = ROUND(subtotal - COALESCE(cost_total, 0), 2) WHERE profit > subtotal;
UPDATE public.work_orders SET profit = ROUND(subtotal - COALESCE(cost_total, 0), 2) WHERE profit > subtotal;

-- 5) Quilometragens irrealistas
UPDATE public.vehicles SET mileage = 111111 WHERE mileage > 2000000;

-- 6) Fundir cliente duplicado
UPDATE public.vehicles SET client_id = '50087ea6-1ddb-4741-9a28-5cae93d23045' WHERE client_id = 'b4af9893-d535-4802-a58d-10fdae48ad27';
UPDATE public.quotes SET client_id = '50087ea6-1ddb-4741-9a28-5cae93d23045' WHERE client_id = 'b4af9893-d535-4802-a58d-10fdae48ad27';
UPDATE public.work_orders SET client_id = '50087ea6-1ddb-4741-9a28-5cae93d23045' WHERE client_id = 'b4af9893-d535-4802-a58d-10fdae48ad27';
UPDATE public.invoices SET client_id = '50087ea6-1ddb-4741-9a28-5cae93d23045' WHERE client_id = 'b4af9893-d535-4802-a58d-10fdae48ad27';
UPDATE public.clients SET deleted_at = now() WHERE id = 'b4af9893-d535-4802-a58d-10fdae48ad27';