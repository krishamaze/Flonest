-- Add updated_at column to invoices table
-- Required for draft ordering and auto-save functionality

BEGIN;

-- Add updated_at column if it doesn't exist
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to automatically update updated_at on row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;

-- Create trigger
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Backfill existing invoices with created_at value
UPDATE invoices 
SET updated_at = created_at 
WHERE updated_at IS NULL;

COMMIT;

