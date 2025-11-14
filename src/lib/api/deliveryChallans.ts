import { supabase } from '../supabase'
import type { DeliveryChallan, DCItem, Product } from '../../types'

export interface DCItemInput {
  product_id: string
  quantity: number
  unit_price?: number
  notes?: string
}

export interface DeliveryChallanWithDetails extends DeliveryChallan {
  dc_items: (DCItem & {
    product: Product
  })[]
  sender_org: {
    id: string
    name: string
  }
  agent_profile: {
    id: string
    email: string
    full_name: string | null
  }
}

/**
 * Create a new delivery challan
 * Only sender org admins can create DCs
 */
export async function createDeliveryChallan(
  senderOrgId: string,
  agentUserId: string,
  items: DCItemInput[],
  dcNumber: string,
  createdBy: string,
  notes?: string
): Promise<DeliveryChallan> {
  // Verify agent relationship exists and is active
  const { data: relationship, error: relError } = await supabase
    .from('agent_relationships')
    .select('id')
    .eq('sender_org_id', senderOrgId)
    .eq('agent_user_id', agentUserId)
    .eq('status', 'active')
    .single()

  if (relError || !relationship) {
    throw new Error('Agent relationship not found or inactive')
  }

  // Create DC
  const { data: dc, error: dcError } = await supabase
    .from('delivery_challans')
    .insert({
      dc_number: dcNumber,
      sender_org_id: senderOrgId,
      agent_user_id: agentUserId,
      created_by: createdBy,
      notes,
    })
    .select()
    .single()

  if (dcError) throw dcError

  // Create DC items
  const dcItemsData = items.map(item => ({
    dc_id: dc.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    notes: item.notes,
  }))

  const { error: itemsError } = await supabase
    .from('dc_items')
    .insert(dcItemsData)

  if (itemsError) {
    // Rollback DC if items fail
    await supabase.from('delivery_challans').delete().eq('id', dc.id)
    throw itemsError
  }

  return dc
}

/**
 * Get all delivery challans for a sender org
 */
export async function getDeliveryChallansForSender(
  senderOrgId: string,
  status?: 'pending' | 'accepted' | 'rejected'
): Promise<DeliveryChallanWithDetails[]> {
  let query = supabase
    .from('delivery_challans')
    .select(`
      *,
      dc_items(
        *,
        products(*)
      ),
      orgs:sender_org_id(*),
      profiles:agent_user_id(id, email, full_name)
    `)
    .eq('sender_org_id', senderOrgId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) throw error

  return (data || []).map((item: any) => ({
    ...item,
    sender_org: item.orgs,
    agent_profile: item.profiles,
  }))
}

/**
 * Get all delivery challans for an agent
 */
export async function getDeliveryChallansForAgent(
  agentUserId: string,
  status?: 'pending' | 'accepted' | 'rejected'
): Promise<DeliveryChallanWithDetails[]> {
  let query = supabase
    .from('delivery_challans')
    .select(`
      *,
      dc_items(
        *,
        products(*)
      ),
      orgs:sender_org_id(*),
      profiles:agent_user_id(id, email, full_name)
    `)
    .eq('agent_user_id', agentUserId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) throw error

  return (data || []).map((item: any) => ({
    ...item,
    sender_org: item.orgs,
    agent_profile: item.profiles,
  }))
}

/**
 * Get delivery challan by ID with items
 */
export async function getDeliveryChallan(dcId: string): Promise<DeliveryChallanWithDetails | null> {
  const { data, error } = await supabase
    .from('delivery_challans')
    .select(`
      *,
      dc_items(
        *,
        products(*)
      ),
      orgs:sender_org_id(*),
      profiles:agent_user_id(id, email, full_name)
    `)
    .eq('id', dcId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }

  return {
    ...data,
    sender_org: (data as any).orgs,
    agent_profile: (data as any).profiles,
  } as unknown as DeliveryChallanWithDetails
}

/**
 * Accept a delivery challan
 * Creates DC stock entries (transaction_type: 'dc_in')
 */
export async function acceptDeliveryChallan(
  dcId: string,
  agentUserId: string,
  acceptedBy: string
): Promise<void> {
  // Get DC with items
  const { data: dc, error: dcError } = await supabase
    .from('delivery_challans')
    .select('*, dc_items(*)')
    .eq('id', dcId)
    .eq('agent_user_id', agentUserId)
    .eq('status', 'pending')
    .single()

  if (dcError) throw dcError
  if (!dc) throw new Error('DC not found or already processed')

  // Update DC status
  const { error: updateError } = await supabase
    .from('delivery_challans')
    .update({
      status: 'accepted',
      accepted_date: new Date().toISOString(),
    })
    .eq('id', dcId)

  if (updateError) throw updateError

  // Create DC stock entries
  const dcStockEntries = (dc.dc_items as any[]).map(item => ({
    sender_org_id: dc.sender_org_id,
    agent_user_id: agentUserId,
    dc_id: dcId,
    product_id: item.product_id,
    transaction_type: 'dc_in',
    quantity: item.quantity,
    notes: `Accepted from DC ${dc.dc_number}`,
    created_by: acceptedBy,
  }))

  const { error: stockError } = await supabase
    .from('dc_stock_ledger')
    .insert(dcStockEntries)

  if (stockError) {
    // Rollback DC status if stock creation fails
    await supabase
      .from('delivery_challans')
      .update({ status: 'pending', accepted_date: null })
      .eq('id', dcId)
    throw stockError
  }
}

/**
 * Reject a delivery challan
 */
export async function rejectDeliveryChallan(
  dcId: string,
  agentUserId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from('delivery_challans')
    .update({
      status: 'rejected',
      rejected_date: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', dcId)
    .eq('agent_user_id', agentUserId)
    .eq('status', 'pending')

  if (error) throw error
}

/**
 * Generate next DC number for an org
 */
export async function generateDCNumber(senderOrgId: string): Promise<string> {
  // Get the latest DC number for this org
  const { data, error } = await supabase
    .from('delivery_challans')
    .select('dc_number')
    .eq('sender_org_id', senderOrgId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error

  if (!data || data.length === 0) {
    return `DC-${Date.now()}-001`
  }

  // Extract number from last DC and increment
  const lastDC = data[0].dc_number
  const match = lastDC.match(/-(\d+)$/)
  
  if (match) {
    const num = parseInt(match[1]) + 1
    return `DC-${Date.now()}-${num.toString().padStart(3, '0')}`
  }

  return `DC-${Date.now()}-001`
}

