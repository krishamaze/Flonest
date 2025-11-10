-- Migration: Create notifications table
-- In-app notifications for product approvals, rejections, and invoice blocks

BEGIN;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('product_approved', 'product_rejected', 'invoice_blocked', 'product_submitted')),
  title text NOT NULL,
  message text NOT NULL,
  related_id uuid, -- master_product_id or invoice_id
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_related_id ON notifications(related_id) WHERE related_id IS NOT NULL;

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own notifications
DROP POLICY IF EXISTS "notifications_read_own" ON notifications;
CREATE POLICY "notifications_read_own" ON notifications
FOR SELECT
USING (user_id = auth.uid());

-- RLS Policy: Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policy: Only service role can insert (notifications created via triggers/RPC)
-- Direct client inserts are blocked - notifications must be created via database triggers or RPC functions

COMMIT;

