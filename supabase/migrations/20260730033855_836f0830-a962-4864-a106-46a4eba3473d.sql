ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS public_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS payment_link_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_online_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_payment_session_id text;

UPDATE public.invoices SET public_token = gen_random_uuid() WHERE public_token IS NULL;

CREATE OR REPLACE FUNCTION public.get_public_invoice(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', i.id,
    'number', i.number,
    'status', i.status,
    'issue_date', i.created_at,
    'due_date', i.due_date,
    'subtotal', i.subtotal,
    'tax', i.tax,
    'total', i.total,
    'notes', i.notes,
    'paid_online_at', i.paid_online_at,
    'provider_pdf_url', i.provider_pdf_url,
    'client_name', c.name,
    'shop', jsonb_build_object(
      'name', s.name,
      'phone', s.phone,
      'email', s.email,
      'address', s.address,
      'logo_url', s.logo_url,
      'currency', s.currency,
      'country_code', s.country_code,
      'online_payments', COALESCE(s.stripe_connect_charges_enabled, false)
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'description', ii.description,
        'quantity', ii.quantity,
        'unit_price', ii.unit_price,
        'vat_rate', ii.vat_rate
      ) ORDER BY ii.created_at)
      FROM public.invoice_items ii WHERE ii.invoice_id = i.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.invoices i
  JOIN public.shops s ON s.id = i.shop_id
  LEFT JOIN public.clients c ON c.id = i.client_id
  WHERE i.public_token = _token
    AND i.payment_link_sent_at IS NOT NULL;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_invoice(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_invoice(uuid) TO anon, authenticated;