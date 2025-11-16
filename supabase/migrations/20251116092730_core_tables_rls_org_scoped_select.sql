-- Enable RLS and add org-scoped SELECT policies for core tables

-- Invoices: readable when user has an active membership in the same org
alter table public.invoices enable row level security;
grant select on public.invoices to authenticated;

create policy "Users can read invoices for their org"
on public.invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = invoices.org_id
      and m.profile_id = auth.uid()
      and m.membership_status = 'active'
  )
);

-- Branches: readable when user has an active membership in the same org
alter table public.branches enable row level security;
grant select on public.branches to authenticated;

create policy "Users can read branches for their org"
on public.branches
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = branches.org_id
      and m.profile_id = auth.uid()
      and m.membership_status = 'active'
  )
);

-- Customers: readable when user has an active membership in the same org
alter table public.customers enable row level security;
grant select on public.customers to authenticated;

create policy "Users can read customers for their org"
on public.customers
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = customers.org_id
      and m.profile_id = auth.uid()
      and m.membership_status = 'active'
  )
);

-- Products: readable when user has an active membership in the same org
alter table public.products enable row level security;
grant select on public.products to authenticated;

create policy "Users can read products for their org"
on public.products
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = products.org_id
      and m.profile_id = auth.uid()
      and m.membership_status = 'active'
  )
);

-- Invoice items: readable when user can read the parent invoice in their org
alter table public.invoice_items enable row level security;
grant select on public.invoice_items to authenticated;

create policy "Users can read invoice items via invoices"
on public.invoice_items
for select
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    join public.memberships m on m.org_id = i.org_id
    where i.id = invoice_items.invoice_id
      and m.profile_id = auth.uid()
      and m.membership_status = 'active'
  )
);

