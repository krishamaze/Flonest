-- RLS: Allow authenticated users to read their own memberships

create policy "Users can read own memberships"
on public.memberships
for select
to authenticated
using (profile_id = auth.uid());

