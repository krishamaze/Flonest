-- Enable RLS on memberships and grant SELECT so policies apply

alter table public.memberships enable row level security;

grant select on public.memberships to authenticated;

