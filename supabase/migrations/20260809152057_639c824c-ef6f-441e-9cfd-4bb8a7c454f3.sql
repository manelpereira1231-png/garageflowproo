ALTER TABLE public.work_order_attachments ADD COLUMN IF NOT EXISTS context text;
CREATE INDEX IF NOT EXISTS idx_work_order_attachments_wo ON public.work_order_attachments (work_order_id);