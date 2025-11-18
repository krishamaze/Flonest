import { supabase } from '../supabase'
import type { Database } from '../supabase'
import { calculateBillTotals, type BillItem } from '../../hooks/useBillCalculations'
import { isValidGSTStateCode } from '../constants/gstStateCodes'
import { getOrgById } from './orgs'

type PurchaseBill = Database['public']['Tables']['purchase_bills']['Row']
type PurchaseBillItem = Database['public']['Tables']['purchase_bill_items']['Row']
type PurchaseBillItemInsert = Database['public']['Tables']['purchase_bill_items']['Insert']

export interface PurchaseBillFormData {
  bill_number: string
  vendor_name: string | null
  vendor_gstin: string | null
  vendor_state_code: string | null
  bill_date: string // ISO date string
  branch_id: string | null
  notes: string | null
  items: PurchaseBillItemFormData[]
}

export interface PurchaseBillItemFormData {
  product_id: string | null
  master_product_id: string | null
  description: string | null
  quantity: number
  unit: string
  unit_price: number
  vendor_hsn_code: string | null
  vendor_gst_rate: number | null
  total_amount: number
}

export interface PurchaseBillWithItems extends PurchaseBill {
  items: PurchaseBillItem[]
}

/**
 * Translate RPC error messages to user-friendly guidance
 * Maps backend error strings to actionable frontend messages
 */
function getUserFriendlyError(error: Error | string): string {
  const message = typeof error === 'string' ? error : error.message
  const lowerMessage = message.toLowerCase()

  // Workflow enforcement errors
  if (lowerMessage.includes('must be approved') || lowerMessage.includes('status "draft"')) {
    return 'Bill must be approved before posting. Please approve the bill first.'
  }

  if (lowerMessage.includes('status "flagged_hsn_mismatch"')) {
    return 'Cannot post bill with HSN mismatches. Resolve mismatches and approve the bill before posting.'
  }

  if (lowerMessage.includes('already posted')) {
    return 'This bill has already been posted to inventory.'
  }

  // Validation errors
  if (lowerMessage.includes('missing product_id') || lowerMessage.includes('no items')) {
    return 'One or more items are missing product links. Please link all items to products before posting.'
  }

  if (lowerMessage.includes('not found') && lowerMessage.includes('product')) {
    return 'One or more products not found. Please verify all items are linked to valid products.'
  }

  if (lowerMessage.includes('cannot post purchase bill with no items')) {
    return 'Cannot post a bill with no items. Please add items before posting.'
  }

  // Return original message if no mapping found
  return message
}

/**
 * Create a new purchase bill
 * 
 * SECURITY: This function recalculates all totals server-side to prevent price tampering.
 * The frontend hook is for UI feedback only - backend values are authoritative.
 */
export async function createPurchaseBill(
  orgId: string,
  userId: string,
  data: PurchaseBillFormData
): Promise<PurchaseBillWithItems> {
  // DATA INTEGRITY: Validate org has state_code before processing
  const org = await getOrgById(orgId)
  if (!org) {
    throw new Error('Organization not found')
  }
  
  const orgStateCode = org.state_code || org.state
  if (!orgStateCode) {
    throw new Error(
      'Organization state code is missing. Please update your organization settings with a valid state code before creating purchase bills.'
    )
  }

  // INPUT VALIDATION: Validate vendor_state_code if provided
  if (data.vendor_state_code && !isValidGSTStateCode(data.vendor_state_code)) {
    throw new Error(`Invalid vendor state code: "${data.vendor_state_code}". Please provide a valid 2-digit GST state code.`)
  }

  // SECURITY: Recalculate totals server-side (do not trust frontend values)
  // Convert items to BillItem format for calculation
  const billItems: BillItem[] = data.items.map(item => ({
    line_total: item.quantity * item.unit_price, // Recalculate from quantity * unit_price
    tax_rate: item.vendor_gst_rate || null,
    hsn_sac_code: item.vendor_hsn_code || null,
  }))

  // Calculate bill totals with GST using server-side logic
  const calculations = calculateBillTotals(
    billItems,
    orgStateCode,
    data.vendor_state_code || null,
    false // GST-exclusive pricing (we calculate from unit_price * quantity)
  )

  // Use server-calculated grand total (not frontend total_amount)
  const totalAmount = calculations.grandTotal

  // Create purchase bill
  const { data: bill, error: billError } = await supabase
    .from('purchase_bills')
    .insert({
      org_id: orgId,
      branch_id: data.branch_id,
      bill_number: data.bill_number,
      vendor_name: data.vendor_name,
      vendor_gstin: data.vendor_gstin,
      vendor_state_code: data.vendor_state_code,
      bill_date: data.bill_date,
      total_amount: totalAmount, // Server-calculated value
      status: 'draft',
      notes: data.notes,
      created_by: userId,
    })
    .select()
    .single()

  if (billError) {
    throw new Error(`Failed to create purchase bill: ${billError.message}`)
  }

  // Create purchase bill items
  // SECURITY: Recalculate total_amount from quantity * unit_price (do not trust frontend)
  const itemsData: PurchaseBillItemInsert[] = data.items.map(item => ({
    purchase_bill_id: bill.id,
    product_id: item.product_id,
    master_product_id: item.master_product_id,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    vendor_hsn_code: item.vendor_hsn_code,
    vendor_gst_rate: item.vendor_gst_rate,
    total_amount: item.quantity * item.unit_price, // Server-calculated value
    hsn_mismatch: false, // Will be checked during approval
    hsn_match_status: 'pending_verification',
  }))

  const { data: items, error: itemsError } = await supabase
    .from('purchase_bill_items')
    .insert(itemsData)
    .select()

  if (itemsError) {
    // Rollback: delete the purchase bill
    await supabase.from('purchase_bills').delete().eq('id', bill.id)
    throw new Error(`Failed to create purchase bill items: ${itemsError.message}`)
  }

  return {
    ...bill,
    items: items || [],
  }
}

/**
 * Get purchase bills for an organization
 */
export async function getPurchaseBills(
  orgId: string,
  filters?: {
    status?: 'draft' | 'flagged_hsn_mismatch' | 'approved' | 'posted'
    branch_id?: string
  }
): Promise<PurchaseBillWithItems[]> {
  let query = supabase
    .from('purchase_bills')
    .select(`
      *,
      items:purchase_bill_items(*)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.branch_id) {
    query = query.eq('branch_id', filters.branch_id)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch purchase bills: ${error.message}`)
  }

  return (data || []) as PurchaseBillWithItems[]
}

/**
 * Generate a unique bill number for purchase bills
 */
export async function generatePurchaseBillNumber(orgId: string): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '')
  
  // Get count of bills created today
  const { count } = await supabase
    .from('purchase_bills')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', today.toISOString().split('T')[0])

  const sequence = (count || 0) + 1
  return `PB-${dateStr}-${sequence.toString().padStart(3, '0')}`
}

/**
 * Approve a purchase bill (draft → approved or flagged_hsn_mismatch)
 * 
 * COMPLIANCE: Enforces HSN validation during approval using RPC function.
 * Checks vendor HSN codes against system HSN codes for all items.
 * 
 * WORKFLOW ENFORCEMENT:
 * - If HSN mismatches found → status set to 'flagged_hsn_mismatch' (blocks posting)
 * - If all HSN codes match → status set to 'approved' (ready for posting)
 * 
 * @param billId - Purchase bill ID
 * @param orgId - Organization ID (for security validation)
 * @param userId - User ID approving the bill
 * @returns Updated purchase bill with 'approved' or 'flagged_hsn_mismatch' status
 */
export async function approvePurchaseBill(
  billId: string,
  orgId: string,
  userId: string
): Promise<PurchaseBillWithItems> {
  // Use RPC function for atomic HSN validation and approval
  const { error: rpcError } = await supabase.rpc(
    'approve_purchase_bill_with_hsn_validation',
    {
      p_bill_id: billId,
      p_org_id: orgId,
      p_user_id: userId,
    }
  )

  if (rpcError) {
    throw new Error(`Failed to approve purchase bill: ${rpcError.message}`)
  }

  // Fetch updated bill with items
  const { data: updatedBill, error: fetchError } = await supabase
    .from('purchase_bills')
    .select(`
      *,
      items:purchase_bill_items(*)
    `)
    .eq('id', billId)
    .eq('org_id', orgId)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch approved bill: ${fetchError.message}`)
  }

  if (!updatedBill) {
    throw new Error('Approved bill not found')
  }

  return updatedBill as PurchaseBillWithItems
}

/**
 * Revert a purchase bill from flagged_hsn_mismatch back to draft
 * 
 * WORKFLOW: Allows flagged_hsn_mismatch → draft transition so users can fix HSN codes
 * 
 * @param billId - Purchase bill ID
 * @param orgId - Organization ID (for security validation)
 * @returns Updated purchase bill with 'draft' status
 */
export async function revertPurchaseBillToDraft(
  billId: string,
  orgId: string
): Promise<PurchaseBillWithItems> {
  // SECURITY: Validate bill exists and belongs to org, and is in flagged_hsn_mismatch status
  const { data, error } = await supabase
    .from('purchase_bills')
    .update({ 
      status: 'draft',
      approved_at: null,
      approved_by: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', billId)
    .eq('org_id', orgId)
    .eq('status', 'flagged_hsn_mismatch') // WORKFLOW GATE: Only allow flagged_hsn_mismatch → draft
    .select(`
      *,
      items:purchase_bill_items(*)
    `)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Purchase bill not found, not flagged for HSN mismatch, or access denied')
    }
    throw new Error(`Failed to revert purchase bill to draft: ${error.message}`)
  }

  if (!data) {
    throw new Error('Purchase bill not found or cannot be reverted')
  }

  return data as PurchaseBillWithItems
}

/**
 * Get purchase bill by ID with full item details
 * 
 * @param billId - Purchase bill ID
 * @param orgId - Organization ID (for security validation)
 * @returns Purchase bill with items and product details
 */
export async function getPurchaseBillById(
  billId: string,
  orgId: string
): Promise<PurchaseBillWithItems> {
  const { data, error } = await supabase
    .from('purchase_bills')
    .select(`
      *,
      items:purchase_bill_items(
        *,
        product:products(
          *,
          master_product:master_products(*)
        )
      )
    `)
    .eq('id', billId)
    .eq('org_id', orgId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Purchase bill not found')
    }
    throw new Error(`Failed to fetch purchase bill: ${error.message}`)
  }

  if (!data) {
    throw new Error('Purchase bill not found')
  }

  return data as PurchaseBillWithItems
}

/**
 * Post a purchase bill to inventory
 * 
 * ATOMIC TRANSACTION: Uses PostgreSQL RPC function to ensure bill status update 
 * and stock_ledger entries succeed or fail together in a single database transaction.
 * 
 * VALIDATION GATES (enforced in RPC):
 * - Bill must be in 'approved' status (draft rejected)
 * - All items must have valid product_id (no ghost items)
 * - Products must exist and belong to the organization
 * 
 * @param billId - Purchase bill ID
 * @param orgId - Organization ID (for security validation)
 * @param userId - User ID posting the bill
 * @returns Updated purchase bill with 'posted' status
 */
export async function postPurchaseBill(
  billId: string,
  orgId: string,
  userId: string
): Promise<PurchaseBillWithItems> {
  // Use RPC function for true atomic transaction
  const { error: rpcError } = await supabase.rpc(
    'post_purchase_bill',
    {
      p_bill_id: billId,
      p_org_id: orgId,
      p_user_id: userId,
    }
  )

  if (rpcError) {
    // Translate RPC error to user-friendly message
    const errorMessage = getUserFriendlyError(rpcError.message || 'Failed to post purchase bill')
    throw new Error(errorMessage)
  }

  // Fetch updated bill with items
  const { data: updatedBill, error: fetchError } = await supabase
    .from('purchase_bills')
    .select(`
      *,
      items:purchase_bill_items(*)
    `)
    .eq('id', billId)
    .eq('org_id', orgId)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch posted bill: ${fetchError.message}`)
  }

  if (!updatedBill) {
    throw new Error('Posted bill not found')
  }

  return updatedBill as PurchaseBillWithItems
}

