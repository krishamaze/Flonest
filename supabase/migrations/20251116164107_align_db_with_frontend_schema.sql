-- Align production schema with frontend expectations for orgs, invoices, inventory, and notifications

-- 1) ORGS: rename gstin -> gst_number to match application code and types
ALTER TABLE public.orgs
  RENAME COLUMN gstin TO gst_number;

-- 2) INVOICES: bring core financial and draft fields in line with the app
-- Also rename legacy "number" column to "invoice_number" for consistency
DO $$
BEGIN
  -- Safely rename number -> invoice_number if it still exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'number'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'invoice_number'
  ) THEN
    ALTER TABLE public.invoices
      RENAME COLUMN number TO invoice_number;
  END IF;
END $$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS draft_data JSONB,
  ADD COLUMN IF NOT EXISTS draft_session_id TEXT;

-- 3) INVENTORY: create table used by dashboard and stock features
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  cost_price NUMERIC(10, 2),
  selling_price NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_org ON public.inventory(org_id);

-- 4) NOTIFICATIONS: enable RLS and lock access down to the owning user
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT own notifications
CREATE POLICY IF NOT EXISTS "Users see own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- UPDATE own notifications (e.g., mark read)
CREATE POLICY IF NOT EXISTS "Users update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- INSERT own notifications (needed for existing frontend create flows)
CREATE POLICY IF NOT EXISTS "Users insert own notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE own notifications
CREATE POLICY IF NOT EXISTS "Users delete own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);









