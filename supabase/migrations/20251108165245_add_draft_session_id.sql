-- Add draft_session_id column to invoices table
-- Enables unique tracking of draft sessions across auto-saves

BEGIN;

-- Add draft_session_id column (nullable, only used for drafts)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS draft_session_id UUID;

-- Create partial unique index for draft sessions
-- Postgres doesn't support partial UNIQUE constraints, so we use a partial unique index
-- This ensures only one draft per session per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_draft_session 
ON invoices (draft_session_id, org_id)
WHERE status = 'draft' AND draft_session_id IS NOT NULL;

-- Create performance index for faster draft session lookups
CREATE INDEX IF NOT EXISTS idx_invoices_draft_session 
ON invoices (draft_session_id, org_id)
WHERE status = 'draft' AND draft_session_id IS NOT NULL;

COMMIT;

