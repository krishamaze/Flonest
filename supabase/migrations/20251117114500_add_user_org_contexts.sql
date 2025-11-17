BEGIN;

-- Table to persist each user's selected organization context for RLS
CREATE TABLE IF NOT EXISTS public.user_org_contexts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_org_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_org_contexts_manage_self"
ON public.user_org_contexts
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Helper to upsert a user's current org context
CREATE OR REPLACE FUNCTION public.set_current_org_context(p_org_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_org_id IS NULL THEN
    DELETE FROM public.user_org_contexts WHERE user_id = auth.uid();
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE profile_id = auth.uid()
      AND membership_status = 'active'
      AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'User does not have access to org %', p_org_id;
  END IF;

  INSERT INTO public.user_org_contexts (user_id, org_id, updated_at)
  VALUES (auth.uid(), p_org_id, now())
  ON CONFLICT (user_id) DO
    UPDATE SET org_id = EXCLUDED.org_id, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_current_org_context(uuid) TO authenticated;

-- Updated helper functions to respect explicit org context
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH selected_context AS (
    SELECT uoc.org_id
    FROM public.user_org_contexts uoc
    WHERE uoc.user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.memberships m
        WHERE m.profile_id = auth.uid()
          AND m.membership_status = 'active'
          AND m.org_id = uoc.org_id
      )
    LIMIT 1
  ),
  fallback_org AS (
    SELECT org_id
    FROM public.memberships
    WHERE profile_id = auth.uid()
      AND membership_status = 'active'
    ORDER BY created_at
    LIMIT 1
  )
  SELECT COALESCE(
    (SELECT org_id FROM selected_context),
    (SELECT org_id FROM fallback_org)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role
  FROM public.memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
    AND (
      org_id = public.current_user_org_id()
      OR public.current_user_org_id() IS NULL
    )
  ORDER BY (org_id = public.current_user_org_id()) DESC, created_at
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_branch_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT branch_id
  FROM public.memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
    AND org_id = public.current_user_org_id()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_branch_ids()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role text;
  v_org_id uuid;
BEGIN
  v_org_id := public.current_user_org_id();
  IF v_org_id IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  SELECT role INTO v_role
  FROM public.memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
    AND org_id = v_org_id
  LIMIT 1;

  IF v_role = 'org_owner' THEN
    RETURN ARRAY(SELECT id FROM public.branches WHERE org_id = v_org_id);
  ELSIF v_role IN ('branch_head','advisor','agent') THEN
    RETURN ARRAY[public.current_user_branch_id()];
  ELSE
    RETURN ARRAY[]::uuid[];
  END IF;
END;
$$;

COMMIT;

