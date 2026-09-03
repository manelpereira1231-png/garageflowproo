UPDATE public.notifications n
SET data = COALESCE(n.data, '{}'::jsonb) || jsonb_build_object('quote_number', q.number),
    link = '/quotes?search=' || replace(q.number, ' ', '%20')
FROM public.quotes q
WHERE q.id::text = n.data->>'quote_id'
  AND COALESCE(n.data->>'quote_number', '') = ''
  AND q.number IS NOT NULL;

UPDATE public.notifications
SET link = '/quotes?search=' || replace(data->>'quote_number', ' ', '%20')
WHERE COALESCE(data->>'quote_number', '') <> ''
  AND (link IS NULL OR link NOT LIKE '/quotes?search=%');