-- Add igst_amount column to invoices table
-- Supports inter-state GST transactions (IGST)

BEGIN;

-- Add igst_amount column
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(10,2) DEFAULT 0;

-- Backfill existing invoices
UPDATE invoices 
SET igst_amount = 0 
WHERE igst_amount IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN invoices.igst_amount IS 'IGST amount for inter-state transactions';

COMMIT;

