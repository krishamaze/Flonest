-- Create agent_relationships and agent_portal_permissions tables
-- Agent relationship: sender org appoints a user (who must be admin of their own org) as their agent
-- Agent portal permissions: agent can grant their branch_heads/advisors access to help manage the portal

BEGIN;

-- Step 1: Create agent_relationships table
CREATE TABLE agent_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  agent_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text CHECK (status IN ('active', 'inactive', 'revoked')) DEFAULT 'active',
  invited_by uuid REFERENCES profiles(id),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sender_org_id, agent_user_id)
);

-- Step 2: Create agent_portal_permissions table
-- Allows agents to grant their team members (branch_head/advisor) access to help manage agent portal
CREATE TABLE agent_portal_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_relationship_id uuid NOT NULL REFERENCES agent_relationships(id) ON DELETE CASCADE,
  helper_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES profiles(id),
  granted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_relationship_id, helper_user_id)
);

-- Step 3: Create indexes for performance
CREATE INDEX idx_agent_relationships_sender_org ON agent_relationships(sender_org_id);
CREATE INDEX idx_agent_relationships_agent_user ON agent_relationships(agent_user_id);
CREATE INDEX idx_agent_relationships_status ON agent_relationships(status);
CREATE INDEX idx_agent_portal_permissions_relationship ON agent_portal_permissions(agent_relationship_id);
CREATE INDEX idx_agent_portal_permissions_helper ON agent_portal_permissions(helper_user_id);

-- Step 4: Enable RLS
ALTER TABLE agent_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_portal_permissions ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policies for agent_relationships

-- Sender org admins can create/manage agent relationships for their org
CREATE POLICY "agent_relationships_sender_admin_manage" ON agent_relationships
  FOR ALL
  USING (
    sender_org_id IN (
      SELECT m.org_id FROM memberships m
      WHERE m.profile_id = auth.uid()
        AND m.role = 'admin'
    )
  );

-- Agents can view their own agent relationships
CREATE POLICY "agent_relationships_agent_view" ON agent_relationships
  FOR SELECT
  USING (
    agent_user_id = auth.uid()
  );

-- Agent's helpers (who have portal permissions) can view the relationship
CREATE POLICY "agent_relationships_helper_view" ON agent_relationships
  FOR SELECT
  USING (
    id IN (
      SELECT app.agent_relationship_id 
      FROM agent_portal_permissions app
      WHERE app.helper_user_id = auth.uid()
    )
  );

-- Step 6: RLS Policies for agent_portal_permissions

-- Agents can manage permissions for their relationships
CREATE POLICY "agent_portal_permissions_agent_manage" ON agent_portal_permissions
  FOR ALL
  USING (
    agent_relationship_id IN (
      SELECT ar.id FROM agent_relationships ar
      WHERE ar.agent_user_id = auth.uid()
    )
  );

-- Helpers can view their own permissions
CREATE POLICY "agent_portal_permissions_helper_view" ON agent_portal_permissions
  FOR SELECT
  USING (
    helper_user_id = auth.uid()
  );

-- Sender org admins can view permissions for their agent relationships
CREATE POLICY "agent_portal_permissions_sender_view" ON agent_portal_permissions
  FOR SELECT
  USING (
    agent_relationship_id IN (
      SELECT ar.id FROM agent_relationships ar
      INNER JOIN memberships m ON m.org_id = ar.sender_org_id
      WHERE m.profile_id = auth.uid()
        AND m.role = 'admin'
    )
  );

-- Step 7: Helper function to check if user has agent access (either as agent or helper)
CREATE OR REPLACE FUNCTION has_agent_access(p_sender_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User is the agent
    SELECT 1 FROM agent_relationships ar
    WHERE ar.sender_org_id = p_sender_org_id
      AND ar.agent_user_id = p_user_id
      AND ar.status = 'active'
  ) OR EXISTS (
    -- User has portal permission as a helper
    SELECT 1 FROM agent_portal_permissions app
    INNER JOIN agent_relationships ar ON ar.id = app.agent_relationship_id
    WHERE ar.sender_org_id = p_sender_org_id
      AND app.helper_user_id = p_user_id
      AND ar.status = 'active'
  );
$$;

-- Step 8: Helper function to get agent relationship details for a user and sender org
CREATE OR REPLACE FUNCTION get_agent_relationship(p_sender_org_id uuid, p_user_id uuid)
RETURNS TABLE (
  relationship_id uuid,
  sender_org_id uuid,
  sender_org_name text,
  agent_user_id uuid,
  is_primary_agent boolean,
  can_manage boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user is the primary agent
  SELECT 
    ar.id,
    ar.sender_org_id,
    o.name,
    ar.agent_user_id,
    true as is_primary_agent,
    true as can_manage
  FROM agent_relationships ar
  INNER JOIN orgs o ON o.id = ar.sender_org_id
  WHERE ar.sender_org_id = p_sender_org_id
    AND ar.agent_user_id = p_user_id
    AND ar.status = 'active'
  
  UNION ALL
  
  -- Check if user is a helper with portal permissions
  SELECT 
    ar.id,
    ar.sender_org_id,
    o.name,
    ar.agent_user_id,
    false as is_primary_agent,
    false as can_manage
  FROM agent_portal_permissions app
  INNER JOIN agent_relationships ar ON ar.id = app.agent_relationship_id
  INNER JOIN orgs o ON o.id = ar.sender_org_id
  WHERE ar.sender_org_id = p_sender_org_id
    AND app.helper_user_id = p_user_id
    AND ar.status = 'active'
  
  LIMIT 1;
$$;

COMMIT;

