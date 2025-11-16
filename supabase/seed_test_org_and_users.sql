DO $$
DECLARE
  v_org_id uuid;
  v_branch_id uuid;

  v_platform_admin_user_id uuid;
  v_org_owner_user_id uuid;
  v_branch_head_user_id uuid;
  v_advisor_user_id uuid;
  v_agent_user_id uuid;
BEGIN
  -- NOTE:
  -- This seed script assumes you have already created auth users
  -- with the following emails (for example, via Supabase Auth UI
  -- or admin API). You can change these emails before running.
  --
  --   finetunetech.e+platformadmin-test@gmail.com
  --   finetunetech.e+orgowner-test@gmail.com
  --   finetunetech.e+branchhead-test@gmail.com
  --   finetunetech.e+advisor-test@gmail.com
  --   finetunetech.e+agent-test@gmail.com
  --
  -- The script is idempotent: it will upsert the org, branch,
  -- profiles, memberships, and agent relationship.

  -- Look up auth user IDs (will be NULL if user does not exist)
  SELECT id INTO v_platform_admin_user_id
  FROM auth.users
  WHERE email = 'finetunetech.e+platformadmin-test@gmail.com';

  SELECT id INTO v_org_owner_user_id
  FROM auth.users
  WHERE email = 'finetunetech.e+orgowner-test@gmail.com';

  SELECT id INTO v_branch_head_user_id
  FROM auth.users
  WHERE email = 'finetunetech.e+branchhead-test@gmail.com';

  SELECT id INTO v_advisor_user_id
  FROM auth.users
  WHERE email = 'finetunetech.e+advisor-test@gmail.com';

  SELECT id INTO v_agent_user_id
  FROM auth.users
  WHERE email = 'finetunetech.e+agent-test@gmail.com';

  -- Create / upsert test org
  INSERT INTO public.orgs (name, slug, gstin, gst_enabled, state, pincode, phone, address)
  VALUES (
    'PerBook Test Org',
    'perbook-test-org',
    NULL,
    false,
    'Tamil Nadu',
    '641112',
    '+91-9994422442',
    'Test address for PerBook QA org'
  )
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name
  RETURNING id INTO v_org_id;

  -- Create / upsert a main test branch for that org
  WITH existing_branch AS (
    SELECT id FROM public.branches
    WHERE org_id = v_org_id AND name = 'PerBook Test Branch'
    LIMIT 1
  )
  INSERT INTO public.branches (org_id, name, address)
  SELECT v_org_id, 'PerBook Test Branch', 'Primary QA branch for PerBook'
  WHERE NOT EXISTS (SELECT 1 FROM existing_branch)
  RETURNING id INTO v_branch_id;

  IF v_branch_id IS NULL THEN
    SELECT id INTO v_branch_id
    FROM public.branches
    WHERE org_id = v_org_id AND name = 'PerBook Test Branch'
    LIMIT 1;
  END IF;

  -- Helper to upsert a profile; expects auth user to exist
  IF v_platform_admin_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, platform_admin)
    VALUES (
      v_platform_admin_user_id,
      'finetunetech.e+platformadmin-test@gmail.com',
      'PerBook Test Platform Admin',
      true
    )
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          platform_admin = EXCLUDED.platform_admin;
  END IF;

  IF v_org_owner_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, platform_admin)
    VALUES (
      v_org_owner_user_id,
      'finetunetech.e+orgowner-test@gmail.com',
      'PerBook Test Org Owner',
      false
    )
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          full_name = EXCLUDED.full_name;

    INSERT INTO public.memberships (profile_id, org_id, branch_id, role, membership_status)
    VALUES (
      v_org_owner_user_id,
      v_org_id,
      NULL,
      'org_owner',
      'active'
    )
    ON CONFLICT (profile_id, org_id) DO UPDATE
      SET branch_id = EXCLUDED.branch_id,
          role = EXCLUDED.role,
          membership_status = EXCLUDED.membership_status;
  END IF;

  IF v_branch_head_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, platform_admin)
    VALUES (
      v_branch_head_user_id,
      'finetunetech.e+branchhead-test@gmail.com',
      'PerBook Test Branch Head',
      false
    )
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          full_name = EXCLUDED.full_name;

    INSERT INTO public.memberships (profile_id, org_id, branch_id, role, membership_status)
    VALUES (
      v_branch_head_user_id,
      v_org_id,
      v_branch_id,
      'branch_head',
      'active'
    )
    ON CONFLICT (profile_id, org_id) DO UPDATE
      SET branch_id = EXCLUDED.branch_id,
          role = EXCLUDED.role,
          membership_status = EXCLUDED.membership_status;

    -- Make this user the branch_head on the branch
    UPDATE public.branches
    SET branch_head_id = v_branch_head_user_id
    WHERE id = v_branch_id;
  END IF;

  IF v_advisor_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, platform_admin)
    VALUES (
      v_advisor_user_id,
      'finetunetech.e+advisor-test@gmail.com',
      'PerBook Test Advisor',
      false
    )
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          full_name = EXCLUDED.full_name;

    INSERT INTO public.memberships (profile_id, org_id, branch_id, role, membership_status)
    VALUES (
      v_advisor_user_id,
      v_org_id,
      v_branch_id,
      'advisor',
      'active'
    )
    ON CONFLICT (profile_id, org_id) DO UPDATE
      SET branch_id = EXCLUDED.branch_id,
          role = EXCLUDED.role,
          membership_status = EXCLUDED.membership_status;
  END IF;

  IF v_agent_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, platform_admin)
    VALUES (
      v_agent_user_id,
      'finetunetech.e+agent-test@gmail.com',
      'PerBook Test Agent',
      false
    )
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          full_name = EXCLUDED.full_name;

    INSERT INTO public.memberships (profile_id, org_id, branch_id, role, membership_status)
    VALUES (
      v_agent_user_id,
      v_org_id,
      v_branch_id,
      'agent',
      'active'
    )
    ON CONFLICT (profile_id, org_id) DO UPDATE
      SET branch_id = EXCLUDED.branch_id,
          role = EXCLUDED.role,
          membership_status = EXCLUDED.membership_status;

    -- Ensure there is an agent_relationship row for test org → agent
    INSERT INTO public.agent_relationships (
      sender_org_id,
      agent_user_id,
      status,
      invited_by,
      invited_at,
      notes
    )
    VALUES (
      v_org_id,
      v_agent_user_id,
      'active',
      v_org_owner_user_id,
      now(),
      'Seeded PerBook test agent relationship'
    )
    ON CONFLICT (sender_org_id, agent_user_id) DO UPDATE
      SET status = EXCLUDED.status,
          notes = EXCLUDED.notes;
  END IF;
END;
$$;


