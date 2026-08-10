ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS legacy_dup_ok boolean NOT NULL DEFAULT false;

-- Marca como "legado" todos os registos duplicados já existentes (mantém o mais antigo de cada grupo).
WITH dups AS (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY shop_id, lower(trim(nif)) ORDER BY created_at) rn
    FROM public.clients WHERE nif IS NOT NULL AND trim(nif) <> ''
  ) t WHERE rn > 1
  UNION
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY shop_id, lower(trim(email)) ORDER BY created_at) rn
    FROM public.clients WHERE email IS NOT NULL AND trim(email) <> ''
  ) t WHERE rn > 1
  UNION
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY shop_id, regexp_replace(phone, '\D', '', 'g') ORDER BY created_at) rn
    FROM public.clients WHERE phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') <> ''
  ) t WHERE rn > 1
)
UPDATE public.clients c SET legacy_dup_ok = true FROM dups d WHERE c.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS clients_unique_shop_nif
  ON public.clients (shop_id, lower(trim(nif)))
  WHERE legacy_dup_ok = false AND nif IS NOT NULL AND trim(nif) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_unique_shop_email
  ON public.clients (shop_id, lower(trim(email)))
  WHERE legacy_dup_ok = false AND email IS NOT NULL AND trim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_unique_shop_phone
  ON public.clients (shop_id, regexp_replace(phone, '\D', '', 'g'))
  WHERE legacy_dup_ok = false AND phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') <> '';