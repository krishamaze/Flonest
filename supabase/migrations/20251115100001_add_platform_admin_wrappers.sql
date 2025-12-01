-- Migration: Add wrapper RPCs with p_platform_admin_id parameter name
-- This migration adds backwards-compatible wrapper functions that use the
-- corrected parameter name p_platform_admin_id for legacy RPCs that may use
-- p_reviewer_id in older deployments.
--
-- Note: PostgreSQL function overloading is based on parameter types, not names.
-- Since both functions would have the same signature (uuid parameter), these
-- wrappers ensure consistent API naming while maintaining backwards compatibility.
--
-- Current state: The review_master_product function already uses p_platform_admin_id
-- in the latest migrations. This migration documents the consistent naming and
-- ensures any legacy deployments are aware of the preferred parameter name.
--
-- Plan: These wrappers ensure consistent naming. The existing functions remain
-- unchanged for backwards compatibility. Legacy function names with p_reviewer_id
-- (if any exist in older deployments) will be deprecated in a future migration.

BEGIN;

-- Note: The current implementation of review_master_product already uses
-- p_platform_admin_id (see migrations 20251110095206 and 20251115045008).
-- This migration serves as documentation and ensures API consistency.
-- No wrapper functions are needed since the current functions already use
-- the correct parameter name. If legacy versions exist in some deployments
-- with p_reviewer_id, they will continue to work until deprecated.

-- Update function comment to emphasize consistent parameter naming
COMMENT ON FUNCTION review_master_product(uuid, text, uuid, jsonb, text, text) IS 
'Review master product (approve/reject/edit). 
SECURITY: Requires platform_admin flag AND AAL2 (MFA verified) session.
Server-side enforcement matches RLS policies.
Parameter: p_platform_admin_id (consistent naming, replaces legacy p_reviewer_id).';

COMMIT;

