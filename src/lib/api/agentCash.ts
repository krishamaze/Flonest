import { supabase } from '../supabase'

export interface AgentCashLedgerEntry {
  id: string
  sender_org_id: string
  agent_user_id: string
  invoice_id: string | null
  transaction_type: 'cash_received' | 'cash_deposited' | 'cash_remitted' | 'adjustment'
  amount: number
  reference_number: string | null
  deposited_to: 'seller_bank' | 'agent_bank' | null
  proof_url: string | null
  status: 'pending' | 'verified' | 'rejected'
  notes: string | null
  created_by: string | null
  created_at: string
  verified_at: string | null
  verified_by: string | null
  rejection_reason: string | null
}

export interface OrgCashSettings {
  org_id: string
  max_cash_holding_days: number
  max_cash_balance: number
  section_269st_limit: number
  require_deposit_proof: boolean
  require_gps_on_collection: boolean
}

export interface CashDepositInput {
  amount: number
  deposited_to: 'seller_bank' | 'agent_bank'
  reference_number: string
  proof_url?: string
  notes?: string
}

/**
 * Record cash received from customer
 * ENFORCES: Section 269ST - ₹2L per transaction limit
 */
export async function recordCashReceived(
  senderOrgId: string,
  agentUserId: string,
  invoiceId: string,
  amount: number,
  createdBy: string
): Promise<AgentCashLedgerEntry> {
  // Get cash settings for validation
  const settings = await getCashSettings(senderOrgId)

  // ENFORCE Section 269ST: ₹2,00,000 limit per transaction
  if (amount > settings.section_269st_limit) {
    throw new Error(
      `Cash amount ₹${amount.toLocaleString('en-IN')} exceeds legal limit of ₹${settings.section_269st_limit.toLocaleString('en-IN')} per transaction (Section 269ST of Income Tax Act)`
    )
  }

  // Check if exceeds max balance
  const currentBalance = await getAgentCashOnHand(senderOrgId, agentUserId)
  const newBalance = currentBalance + amount

  if (newBalance > settings.max_cash_balance) {
    throw new Error(
      `Cash balance would exceed limit. Current: ₹${currentBalance.toLocaleString('en-IN')}, Limit: ₹${settings.max_cash_balance.toLocaleString('en-IN')}. Please deposit cash before accepting more.`
    )
  }

  // Check for overdue cash
  const hasOverdue = await hasOverdueCash(senderOrgId, agentUserId)
  if (hasOverdue) {
    throw new Error(
      `You have overdue cash deposits. Please settle pending cash before accepting new payments.`
    )
  }

  const { data, error } = await supabase
    .from('agent_cash_ledger' as any)
    .insert({
      sender_org_id: senderOrgId,
      agent_user_id: agentUserId,
      invoice_id: invoiceId,
      transaction_type: 'cash_received',
      amount,
      status: 'pending',
      created_by: createdBy,
      notes: 'Cash received from customer',
    })
    .select()
    .single()

  if (error) throw error
  return data as AgentCashLedgerEntry
}

/**
 * Record cash deposit
 */
export async function recordCashDeposit(
  senderOrgId: string,
  agentUserId: string,
  depositData: CashDepositInput,
  createdBy: string
): Promise<AgentCashLedgerEntry> {
  const settings = await getCashSettings(senderOrgId)

  // Validate proof is provided if required
  if (settings.require_deposit_proof && !depositData.proof_url && !depositData.reference_number) {
    throw new Error('Deposit proof and reference number are required')
  }

  // Validate amount doesn't exceed current balance
  const currentBalance = await getAgentCashOnHand(senderOrgId, agentUserId)
  if (Math.abs(depositData.amount) > currentBalance) {
    throw new Error(
      `Deposit amount ₹${Math.abs(depositData.amount).toLocaleString('en-IN')} exceeds cash on hand ₹${currentBalance.toLocaleString('en-IN')}`
    )
  }

  const { data, error } = await supabase
    .from('agent_cash_ledger' as any)
    .insert({
      sender_org_id: senderOrgId,
      agent_user_id: agentUserId,
      transaction_type: depositData.deposited_to === 'seller_bank' ? 'cash_remitted' : 'cash_deposited',
      amount: -Math.abs(depositData.amount), // Negative for cash out
      reference_number: depositData.reference_number,
      deposited_to: depositData.deposited_to,
      proof_url: depositData.proof_url,
      status: 'pending',
      notes: depositData.notes,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) throw error
  return data as AgentCashLedgerEntry
}

/**
 * Get agent cash on hand (current balance)
 */
export async function getAgentCashOnHand(
  senderOrgId: string,
  agentUserId: string
): Promise<number> {
  const { data, error } = await supabase
    .rpc('get_agent_cash_on_hand' as any, {
      p_sender_org_id: senderOrgId,
      p_agent_user_id: agentUserId,
    })

  if (error) throw error
  return data || 0
}

/**
 * Check if agent has overdue cash
 */
export async function hasOverdueCash(
  senderOrgId: string,
  agentUserId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('has_overdue_cash' as any, {
      p_sender_org_id: senderOrgId,
      p_agent_user_id: agentUserId,
    })

  if (error) {
    console.error('Error checking overdue cash:', error)
    return false
  }
  return data || false
}

/**
 * Check if cash balance exceeds limit
 */
export async function exceedsCashLimit(
  senderOrgId: string,
  agentUserId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('exceeds_cash_limit' as any, {
      p_sender_org_id: senderOrgId,
      p_agent_user_id: agentUserId,
    })

  if (error) {
    console.error('Error checking cash limit:', error)
    return false
  }
  return data || false
}

/**
 * Get cash ledger entries for an agent
 */
export async function getAgentCashLedger(
  senderOrgId: string,
  agentUserId: string
): Promise<(AgentCashLedgerEntry & {
  invoice?: {
    invoice_number: string
    total_amount: number
  }
})[]> {
  const { data, error } = await supabase
    .from('agent_cash_ledger' as any)
    .select(`
      *,
      invoices(invoice_number, total_amount)
    `)
    .eq('sender_org_id', senderOrgId)
    .eq('agent_user_id', agentUserId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((item: any) => ({
    ...item,
    invoice: item.invoices,
  }))
}

/**
 * Get pending cash deposits (awaiting verification)
 */
export async function getPendingDeposits(
  senderOrgId: string,
  agentUserId: string
): Promise<AgentCashLedgerEntry[]> {
  const { data, error } = await supabase
    .from('agent_cash_ledger' as any)
    .select('*')
    .eq('sender_org_id', senderOrgId)
    .eq('agent_user_id', agentUserId)
    .in('transaction_type', ['cash_deposited', 'cash_remitted'])
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as AgentCashLedgerEntry[]
}

/**
 * Get cash settings for an org
 */
export async function getCashSettings(orgId: string): Promise<OrgCashSettings> {
  const { data, error } = await supabase
    .from('org_cash_settings' as any)
    .select('*')
    .eq('org_id', orgId)
    .single()

  if (error) {
    // Return defaults if not found
    return {
      org_id: orgId,
      max_cash_holding_days: 3,
      max_cash_balance: 50000,
      section_269st_limit: 200000,
      require_deposit_proof: true,
      require_gps_on_collection: false,
    }
  }

  return data as OrgCashSettings
}

/**
 * Update cash settings (admin only)
 */
export async function updateCashSettings(
  orgId: string,
  settings: Partial<OrgCashSettings>
): Promise<void> {
  const { error } = await supabase
    .from('org_cash_settings' as any)
    .upsert({
      org_id: orgId,
      ...settings,
      updated_at: new Date().toISOString(),
    })

  if (error) throw error
}

/**
 * Verify cash deposit (sender admin only)
 */
export async function verifyCashDeposit(
  entryId: string,
  verifiedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('agent_cash_ledger' as any)
    .update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: verifiedBy,
    })
    .eq('id', entryId)
    .eq('status', 'pending')

  if (error) throw error

  // Also update related invoice status to 'verified' if linked
  const { data: entry } = await supabase
    .from('agent_cash_ledger' as any)
    .select('invoice_id')
    .eq('id', entryId)
    .single()

  if (entry?.invoice_id) {
    await supabase
      .from('invoices')
      .update({ payment_status: 'verified', payment_verified_at: new Date().toISOString(), payment_verified_by: verifiedBy })
      .eq('id', entry.invoice_id)
  }
}

/**
 * Reject cash deposit (sender admin only)
 */
export async function rejectCashDeposit(
  entryId: string,
  reason: string,
  rejectedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('agent_cash_ledger' as any)
    .update({
      status: 'rejected',
      rejection_reason: reason,
      verified_at: new Date().toISOString(),
      verified_by: rejectedBy,
    })
    .eq('id', entryId)
    .eq('status', 'pending')

  if (error) throw error
}

/**
 * Get all agents' cash ledgers for sender org (admin view)
 */
export async function getAllAgentsCashLedger(
  senderOrgId: string
): Promise<(AgentCashLedgerEntry & {
  agent_profile: {
    email: string
    full_name: string | null
  }
  invoice?: {
    invoice_number: string
  }
})[]> {
  const { data, error } = await supabase
    .from('agent_cash_ledger' as any)
    .select(`
      *,
      profiles!agent_cash_ledger_agent_user_id_fkey(email, full_name),
      invoices(invoice_number)
    `)
    .eq('sender_org_id', senderOrgId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((item: any) => ({
    ...item,
    agent_profile: item.profiles,
    invoice: item.invoices,
  }))
}

/**
 * Get pending verifications (all agents, for sender admin)
 */
export async function getPendingVerifications(senderOrgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('agent_cash_ledger' as any)
    .select('*', { count: 'exact', head: true })
    .eq('sender_org_id', senderOrgId)
    .eq('status', 'pending')
    .in('transaction_type', ['cash_deposited', 'cash_remitted'])

  if (error) {
    console.error('Error getting pending verifications:', error)
    return 0
  }
  return count || 0
}

/**
 * Validate cash amount against Section 269ST
 */
export function validateSection269ST(amount: number, limit: number = 200000): {
  valid: boolean
  error?: string
} {
  if (amount > limit) {
    return {
      valid: false,
      error: `Cash payment of ₹${amount.toLocaleString('en-IN')} exceeds legal limit of ₹${limit.toLocaleString('en-IN')} per transaction (Section 269ST of Income Tax Act, 1961). Please use digital payment methods.`
    }
  }
  return { valid: true }
}

