-- Billing plans master table
create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price_in_paise integer not null default 0 check (price_in_paise >= 0),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  trial_period_days integer not null default 0 check (trial_period_days >= 0),
  is_active boolean not null default true,
  max_seats integer check (max_seats is null or max_seats > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_plans is 'Catalog of subscription plans available to organizations.';

-- Single subscription per organization
create table if not exists public.org_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  plan_id uuid not null references public.billing_plans(id),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  quantity integer not null default 1 check (quantity > 0),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  pending_plan_id uuid references public.billing_plans(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_subscriptions_unique_org unique (org_id)
);

comment on table public.org_subscriptions is 'Each organization owns at most one active subscription.';

create index if not exists org_subscriptions_plan_idx on public.org_subscriptions(plan_id);
create index if not exists org_subscriptions_status_idx on public.org_subscriptions(status);

-- Event/audit log for subscription lifecycle changes
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  org_subscription_id uuid not null references public.org_subscriptions(id) on delete cascade,
  event_type text not null check (event_type in (
    'created',
    'plan_changed',
    'cancellation_scheduled',
    'canceled',
    'renewed',
    'payment_failed',
    'status_updated'
  )),
  event_time timestamptz not null default now(),
  actor_user_id uuid references auth.users(id),
  payload jsonb not null default '{}'::jsonb
);

comment on table public.subscription_events is 'Lightweight audit log for subscription changes and billing history.';

create index if not exists subscription_events_subscription_idx on public.subscription_events(org_subscription_id);
create index if not exists subscription_events_event_time_idx on public.subscription_events(event_time desc);

-- Seed default plans (idempotent)
insert into public.billing_plans (slug, name, description, price_in_paise, billing_interval, trial_period_days, metadata)
values
  ('trial', 'Trial', '14-day complimentary access for onboarding', 0, 'monthly', 14, jsonb_build_object('seats_included', 5)),
  ('standard', 'Standard', 'Core inventory features for growing teams', 49900, 'monthly', 0, jsonb_build_object('seats_included', 25))
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  price_in_paise = excluded.price_in_paise,
  billing_interval = excluded.billing_interval,
  trial_period_days = excluded.trial_period_days,
  metadata = excluded.metadata,
  updated_at = now();

