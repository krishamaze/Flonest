-- Migration: Create notification triggers
-- Automatically create notifications when products are approved/rejected

BEGIN;

-- Function to create notification for product approval/rejection
CREATE OR REPLACE FUNCTION create_product_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_title text;
  v_message text;
  v_type text;
BEGIN
  -- Only create notification if approval_status changed
  IF OLD.approval_status = NEW.approval_status THEN
    RETURN NEW;
  END IF;

  -- Get the user who submitted the product (created_by or from submitted_org_id)
  -- If created_by is set, use it; otherwise, we can't determine the user
  IF NEW.created_by IS NULL THEN
    RETURN NEW; -- No user to notify
  END IF;

  v_user_id := NEW.created_by;

  -- Determine notification type and content
  IF NEW.approval_status = 'approved' THEN
    v_type := 'product_approved';
    v_title := 'Product Approved';
    v_message := format('Your product "%s" (SKU: %s) has been approved and is now available for use.', NEW.name, NEW.sku);
  ELSIF NEW.approval_status = 'rejected' THEN
    v_type := 'product_rejected';
    v_title := 'Product Rejected';
    v_message := format('Your product "%s" (SKU: %s) has been rejected.', NEW.name, NEW.sku);
    IF NEW.rejection_reason IS NOT NULL THEN
      v_message := v_message || format(' Reason: %s', NEW.rejection_reason);
    END IF;
  ELSE
    -- Don't create notification for other status changes
    RETURN NEW;
  END IF;

  -- Create notification
  INSERT INTO notifications (user_id, type, title, message, related_id, created_at)
  VALUES (v_user_id, v_type, v_title, v_message, NEW.id, NOW());

  RETURN NEW;
END;
$$;

-- Create trigger on master_products table
DROP TRIGGER IF EXISTS trigger_create_product_notification ON master_products;
CREATE TRIGGER trigger_create_product_notification
  AFTER UPDATE OF approval_status ON master_products
  FOR EACH ROW
  WHEN (OLD.approval_status IS DISTINCT FROM NEW.approval_status)
  EXECUTE FUNCTION create_product_notification();

-- Function to create notification for product submission
-- This is called when a product is first submitted (approval_status = 'pending')
CREATE OR REPLACE FUNCTION create_submission_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create notification for new pending submissions
  IF NEW.approval_status != 'pending' OR NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Create notification for the submitter (optional - can be removed if not needed)
  -- For now, we'll skip submission notifications to avoid spam
  -- Uncomment if you want to notify users when they submit a product
  /*
  INSERT INTO notifications (user_id, type, title, message, related_id, created_at)
  VALUES (
    NEW.created_by,
    'product_submitted',
    'Product Submitted',
    format('Your product "%s" (SKU: %s) has been submitted for review.', NEW.name, NEW.sku),
    NEW.id,
    NOW()
  );
  */

  RETURN NEW;
END;
$$;

-- Create trigger for new submissions (optional - currently disabled)
-- DROP TRIGGER IF EXISTS trigger_create_submission_notification ON master_products;
-- CREATE TRIGGER trigger_create_submission_notification
--   AFTER INSERT ON master_products
--   FOR EACH ROW
--   WHEN (NEW.approval_status = 'pending')
--   EXECUTE FUNCTION create_submission_notification();

COMMIT;

