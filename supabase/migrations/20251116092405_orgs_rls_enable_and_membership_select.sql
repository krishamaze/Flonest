-- Enable RLS on orgs and allow users to read orgs they have memberships in

alter table public.orgs enable row level security;

grant select on public.orgs to authenticated;

create policy "Users can read orgs via membership"
on public.orgs
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships
    where memberships.org_id = orgs.id
      and memberships.profile_id = auth.uid()
  )
);

