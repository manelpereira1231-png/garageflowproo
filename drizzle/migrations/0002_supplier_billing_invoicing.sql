-- Faturação própria do fornecedor: reutiliza integracao_faturacao (mesmo provider/cripto),
-- acrescentando o âmbito supplier_id sem tocar no âmbito shop_id das oficinas.
ALTER TABLE public.integracao_faturacao
  ALTER COLUMN shop_id DROP NOT NULL;

ALTER TABLE public.integracao_faturacao
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.gsn_suppliers(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS integracao_faturacao_supplier_uidx
  ON public.integracao_faturacao (supplier_id)
  WHERE supplier_id IS NOT NULL;

DROP POLICY IF EXISTS "Suppliers manage own invoicing integration" ON public.integracao_faturacao;
CREATE POLICY "Suppliers manage own invoicing integration"
ON public.integracao_faturacao
FOR ALL
TO authenticated
USING (
  supplier_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.gsn_suppliers s
    WHERE s.id = integracao_faturacao.supplier_id AND s.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  supplier_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.gsn_suppliers s
    WHERE s.id = integracao_faturacao.supplier_id AND s.owner_user_id = auth.uid()
  )
);

-- Rasto real da fatura emitida no provedor externo
ALTER TABLE public.gsn_invoices
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_invoice_id text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_shop_id uuid,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE UNIQUE INDEX IF NOT EXISTS gsn_invoices_order_uidx
  ON public.gsn_invoices (order_id)
  WHERE order_id IS NOT NULL;
