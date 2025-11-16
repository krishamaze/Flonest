-- Add agent-related notification types to notifications table check constraint

BEGIN;

-- Drop existing check constraint
ALTER TABLE notifications 
  DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new check constraint with agent notification types
ALTER TABLE notifications 
  ADD CONSTRAINT notifications_type_check 
  CHECK (type IN (
    'product_approved',
    'product_rejected',
    'invoice_blocked',
    'product_submitted',
    'agent_invited',
    'agent_dc_issued',
    'agent_dc_accepted',
    'agent_dc_rejected',
    'agent_sale_created',
    'dc_accepted',
    'dc_rejected'
  ));

COMMIT;

