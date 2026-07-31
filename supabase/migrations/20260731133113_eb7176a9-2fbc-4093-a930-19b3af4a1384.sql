CREATE OR REPLACE FUNCTION public.get_public_invoice(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'tax', COALESCE(i.vat_total, 0),
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
      'currency', COALESCE(i.currency, s.currency),
      'country_code', s.country_code,
      'online_payments', true
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'description', ii.description,
        'quantity', ii.quantity,
        'unit_price', ii.unit_price,
        'vat_rate', ii.vat_rate
      ))
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
$function$;