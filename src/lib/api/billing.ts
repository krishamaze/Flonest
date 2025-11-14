import { supabase } from '../supabase'
import type {
  BillingPlan,
  OrgSubscription,
  SubscriptionEvent,
} from '../../types'
import type { Json } from '../../types/database'

export type SubscriptionStatus = OrgSubscription['status']

export interface SubscriptionSummary {
  subscription: OrgSubscription | null
  plan: BillingPlan | null
  pendingPlan: BillingPlan | null
  events: SubscriptionEvent[]
  seatUsage: number
  seatLimit: number | null
}

type SubscriptionRow = OrgSubscription & {
  plan?: BillingPlan | null
  pending_plan?: BillingPlan | null
}

const BILLING_EVENT_LIMIT = 20

export async function listActivePlans(): Promise<BillingPlan[]> {
  const { data, error } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_in_paise', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function fetchSubscriptionSummary(orgId: string): Promise<SubscriptionSummary> {
  const [subscriptionResult, seatUsage] = await Promise.all([
    supabase
      .from('org_subscriptions')
      .select(`
        *,
        plan:billing_plans!org_subscriptions_plan_id_fkey(*),
        pending_plan:billing_plans!org_subscriptions_pending_plan_id_fkey(*)
      `)
      .eq('org_id', orgId)
      .maybeSingle(),
    getSeatUsage(orgId),
  ])

  if (subscriptionResult.error) {
    throw new Error(subscriptionResult.error.message)
  }

  const subscription = (subscriptionResult.data as SubscriptionRow | null) ?? null

  let events: SubscriptionEvent[] = []
  if (subscription) {
    const { data: eventData, error: eventError } = await supabase
      .from('subscription_events')
      .select('*')
      .eq('org_subscription_id', subscription.id)
      .order('event_time', { ascending: false })
      .limit(BILLING_EVENT_LIMIT)

    if (eventError) {
      throw new Error(eventError.message)
    }
    events = eventData ?? []
  }

  const plan = (subscription?.plan as BillingPlan) ?? null
  const pendingPlan = (subscription?.pending_plan as BillingPlan | null) ?? null

  return {
    subscription,
    plan,
    pendingPlan,
    events,
    seatUsage,
    seatLimit: plan ? getSeatLimitFromMetadata(plan.metadata) : null,
  }
}

export async function upgradeSubscription(
  orgId: string,
  planSlug: string,
  options: { quantity?: number; actorUserId?: string } = {},
) {
  const plan = await getPlanBySlug(planSlug)
  const quantity = options.quantity ?? 1
  const now = new Date()
  const { startIso, endIso, status } = buildPeriodForPlan(plan, now, false)

  const existing = await getSubscriptionRecord(orgId)
  if (!existing) {
    const created = await createSubscription(orgId, plan, quantity)
    return created
  }

  const { data, error } = await supabase
    .from('org_subscriptions')
    .update({
      plan_id: plan.id,
      pending_plan_id: null,
      cancel_at_period_end: false,
      status: 'active',
      quantity,
      current_period_start: startIso,
      current_period_end: endIso,
      updated_at: now.toISOString(),
    })
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await recordEvent(data.id, 'plan_changed', {
    action: existing.plan_id === plan.id ? 'refresh' : 'upgrade',
    plan: plan.slug,
    quantity,
    new_status: status,
  }, options.actorUserId)

  return data
}

export async function scheduleDowngrade(
  orgId: string,
  planSlug: string,
  options: { actorUserId?: string } = {},
) {
  const plan = await getPlanBySlug(planSlug)
  const existing = await requireSubscription(orgId)

  const { data, error } = await supabase
    .from('org_subscriptions')
    .update({
      pending_plan_id: plan.id,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await recordEvent(existing.id, 'plan_changed', {
    action: 'schedule_downgrade',
    plan: plan.slug,
    effective_on: existing.current_period_end,
  }, options.actorUserId)

  return data
}

export async function cancelSubscriptionAtPeriodEnd(
  orgId: string,
  options: { actorUserId?: string } = {},
) {
  const subscription = await requireSubscription(orgId)
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('org_subscriptions')
    .update({
      cancel_at_period_end: true,
      pending_plan_id: null,
      updated_at: nowIso,
    })
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await recordEvent(subscription.id, 'cancellation_scheduled', {
    effective_on: subscription.current_period_end,
  }, options.actorUserId)

  return data
}

export async function resumeSubscription(
  orgId: string,
  options: { actorUserId?: string } = {},
) {
  const subscription = await requireSubscription(orgId)
  if (!subscription.cancel_at_period_end && !subscription.pending_plan_id) {
    return subscription
  }

  const { data, error } = await supabase
    .from('org_subscriptions')
    .update({
      cancel_at_period_end: false,
      pending_plan_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await recordEvent(subscription.id, 'status_updated', {
    action: 'resume',
  }, options.actorUserId)

  return data
}

async function createSubscription(orgId: string, plan: BillingPlan, quantity: number) {
  const now = new Date()
  const { startIso, endIso, status } = buildPeriodForPlan(plan, now, plan.trial_period_days > 0)

  const { data, error } = await supabase
    .from('org_subscriptions')
    .insert({
      org_id: orgId,
      plan_id: plan.id,
      status,
      quantity,
      current_period_start: startIso,
      current_period_end: endIso,
      cancel_at_period_end: false,
      metadata: {},
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await recordEvent(data.id, 'created', {
    plan: plan.slug,
    trial_days: status === 'trialing' ? plan.trial_period_days : 0,
    quantity,
  })

  return data
}

async function getSubscriptionRecord(orgId: string): Promise<OrgSubscription | null> {
  const { data, error } = await supabase
    .from('org_subscriptions')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? null
}

async function requireSubscription(orgId: string) {
  const subscription = await getSubscriptionRecord(orgId)
  if (!subscription) {
    throw new Error('No active subscription found for this organization')
  }
  return subscription
}

async function getSeatUsage(orgId: string) {
  const { count, error } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('membership_status', 'active')

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

async function getPlanBySlug(slug: string): Promise<BillingPlan> {
  const { data, error } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('Selected plan is unavailable')
  }

  return data
}

function buildPeriodForPlan(plan: BillingPlan, start: Date, allowTrial: boolean) {
  const startIso = start.toISOString()

  if (allowTrial && plan.trial_period_days > 0) {
    const trialEnd = addDays(start, plan.trial_period_days)
    return {
      startIso,
      endIso: trialEnd.toISOString(),
      status: 'trialing' as SubscriptionStatus,
    }
  }

  const end = addInterval(start, plan.billing_interval)
  return {
    startIso,
    endIso: end.toISOString(),
    status: 'active' as SubscriptionStatus,
  }
}

function addInterval(date: Date, interval: string) {
  const copy = new Date(date)
  if (interval === 'yearly') {
    copy.setFullYear(copy.getFullYear() + 1)
  } else {
    copy.setMonth(copy.getMonth() + 1)
  }
  return copy
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function isObjectRecord(value: Json | null): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getSeatLimitFromMetadata(metadata: Json): number | null {
  if (!isObjectRecord(metadata)) return null
  const metadataRecord = metadata as Record<string, any>
  const seatValue = metadataRecord.seats_included
  return typeof seatValue === 'number' ? seatValue : null
}

async function recordEvent(
  subscriptionId: string,
  eventType: SubscriptionEvent['event_type'],
  payload: Record<string, any>,
  actorUserId?: string,
) {
  const { error } = await supabase.from('subscription_events').insert({
    org_subscription_id: subscriptionId,
    event_type: eventType,
    payload,
    actor_user_id: actorUserId ?? null,
  })

  if (error) {
    // Surface but don't block main action
    console.error('Failed to record subscription event', error)
  }
}

