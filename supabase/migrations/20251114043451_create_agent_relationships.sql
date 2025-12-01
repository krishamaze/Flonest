-- Agent Portal: Create agent relationships and permissions tables
-- This allows admins to designate their org as agents for other businesses

BEGIN;

-- Agent Relationships table
-- Tracks which users (who must be admins of their own org) act as agents for sender orgs
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

-- Agent Portal Permissions table
-- Allows agents (admins) to grant their branch_heads/advisors access to help with agent portal
CREATE TABLE agent_portal_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_relationship_id uuid NOT NULL REFERENCES agent_relationships(id) ON DELETE CASCADE,
  helper_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES profiles(id),
  granted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_relationship_id, helper_user_id)
);

-- Indexes for performance
CREATE INDEX idx_agent_relationships_sender_org ON agent_relationships(sender_org_id);
CREATE INDEX idx_agent_relationships_agent_user ON agent_relationships(agent_user_id);
CREATE INDEX idx_agent_relationships_status ON agent_relationships(status) WHERE status = 'active';
CREATE INDEX idx_agent_portal_permissions_relationship ON agent_portal_permissions(agent_relationship_id);
CREATE INDEX idx_agent_portal_permissions_helper ON agent_portal_permissions(helper_user_id);

-- Enable RLS
ALTER TABLE agent_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_portal_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_relationships

-- Policy: Sender org admins can manage agent relationships for their org
CREATE POLICY "agent_relationships_sender_admin_manage" ON agent_relationships
FOR ALL
USING (
  sender_org_id IN (
    SELECT org_id FROM memberships
    WHERE profile_id = auth.uid()
      AND role = 'admin'
  )
);

-- Policy: Agents can view their own relationships
CREATE POLICY "agent_relationships_agent_view" ON agent_relationships
FOR SELECT
USING (agent_user_id = auth.uid());

-- Policy: Agents' helpers can view relationships if they have portal permissions
CREATE POLICY "agent_relationships_helper_view" ON agent_relationships
FOR SELECT
USING (
  id IN (
    SELECT agent_relationship_id FROM agent_portal_permissions
    WHERE helper_user_id = auth.uid()
  )
);

-- RLS Policies for agent_portal_permissions

-- Policy: Agents can manage permissions for their relationships
CREATE POLICY "agent_portal_permissions_agent_manage" ON agent_portal_permissions
FOR ALL
USING (
  agent_relationship_id IN (
    SELECT id FROM agent_relationships
    WHERE agent_user_id = auth.uid()
  )
);

-- Policy: Helpers can view their own permissions
CREATE POLICY "agent_portal_permissions_helper_view" ON agent_portal_permissions
FOR SELECT
USING (helper_user_id = auth.uid());

-- Policy: Sender org admins can view all permissions for their agents
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

-- Helper function: Check if user is an agent for a specific org
CREATE OR REPLACE FUNCTION is_agent_for_org(p_user_id uuid, p_sender_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM agent_relationships
    WHERE agent_user_id = p_user_id
      AND sender_org_id = p_sender_org_id
      AND status = 'active'
  );
END;
$$;

-- Helper function: Check if user has agent portal permissions for a relationship
CREATE OR REPLACE FUNCTION has_agent_portal_access(p_user_id uuid, p_relationship_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- User is the agent themselves
  IF EXISTS (
    SELECT 1 FROM agent_relationships
    WHERE id = p_relationship_id
      AND agent_user_id = p_user_id
      AND status = 'active'
  ) THEN
    RETURN true;
  END IF;
  
  -- User has been granted permission by the agent
  IF EXISTS (
    SELECT 1 FROM agent_portal_permissions
    WHERE agent_relationship_id = p_relationship_id
      AND helper_user_id = p_user_id
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Comments for documentation
COMMENT ON TABLE agent_relationships IS 'Tracks agent relationships between sender orgs and agent users (who are admins of their own orgs)';
COMMENT ON TABLE agent_portal_permissions IS 'Grants agent portal access to helpers (branch_head/advisor) from agent''s org';
COMMENT ON COLUMN agent_relationships.agent_user_id IS 'Must be an admin of their own organization to act as agent';
COMMENT ON COLUMN agent_relationships.status IS 'active: relationship is active, inactive: temporarily disabled, revoked: permanently disabled';

COMMIT;

