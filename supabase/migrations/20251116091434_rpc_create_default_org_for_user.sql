-- RPC: create_default_org_for_user
-- Reintroduces the SECURITY DEFINER function used by AuthContext to
-- auto-create a default org + org_owner membership for new business owners.

create or replace function public.create_default_org_for_user()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile_id uuid;
  v_org_id uuid;
  v_membership_id uuid;
  v_org_name text;
  v_org_slug text;
  v_org_record public.orgs%rowtype;
  v_membership_record public.memberships%rowtype;
begin
  -- Ensure caller is authenticated
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'User must be authenticated';
  end if;

  -- Ensure profile exists
  select id into v_profile_id
  from public.profiles
  where id = v_user_id;

  if v_profile_id is null then
    raise exception 'User profile not found. Please create profile first.';
  end if;

  -- Ensure user does not already have a membership
  select id into v_membership_id
  from public.memberships
  where profile_id = v_user_id
  limit 1;

  if v_membership_id is not null then
    raise exception 'User already has a membership';
  end if;

  -- Generate default org name + slug based on user id
  v_org_name := 'test-' || left(v_user_id::text, 8);
  v_org_slug := 'test-' || left(v_user_id::text, 8);

  -- Create org in Default state
  insert into public.orgs (name, slug, state, gst_enabled)
  values (v_org_name, v_org_slug, 'Default', false)
  returning * into v_org_record;

  v_org_id := v_org_record.id;

  -- Create membership with org_owner role and active status
  insert into public.memberships (profile_id, org_id, role, membership_status)
  values (v_profile_id, v_org_id, 'org_owner', 'active')
  returning * into v_membership_record;

  v_membership_id := v_membership_record.id;

  return json_build_object(
    'org_id', v_org_id,
    'membership_id', v_membership_id,
    'org', row_to_json(v_org_record),
    'membership', row_to_json(v_membership_record)
  );
end;
$$;

grant execute on function public.create_default_org_for_user() to authenticated;

