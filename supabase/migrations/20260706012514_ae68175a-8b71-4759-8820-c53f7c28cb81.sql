ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS credit_note_provider_id text,
  ADD COLUMN IF NOT EXISTS credit_note_number text,
  ADD COLUMN IF NOT EXISTS credit_note_atcud text,
  ADD COLUMN IF NOT EXISTS credit_note_pdf_url text,
  ADD COLUMN IF NOT EXISTS credit_note_permalink text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;