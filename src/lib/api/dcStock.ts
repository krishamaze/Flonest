import { supabase } from '../supabase'
import type { DCStockLedger, Product } from '../../types'

export interface DCStockSummary {
  product_id: string
  product: Product
  current_stock: number
}

/**
 * Get current DC stock for an agent from a sender org
 * Calculates: dc_in adds, dc_sale subtracts, dc_return adds, dc_adjustment is relative
 */
export async function getDCStock(
  senderOrgId: string,
  agentUserId: string
): Promise<DCStockSummary[]> {
  // Get all DC stock transactions
  const { data: transactions, error } = await supabase
    .from('dc_stock_ledger')
    .select('product_id, transaction_type, quantity, products(*)')
    .eq('sender_org_id', senderOrgId)
    .eq('agent_user_id', agentUserId)
    .order('created_at', { ascending: true })

  if (error) throw error

  if (!transactions || transactions.length === 0) return []

  // Calculate stock by product
  const stockMap = new Map<string, { product: Product; stock: number }>()

  for (const txn of transactions as any[]) {
    const existing = stockMap.get(txn.product_id)
    const product = txn.products

    let stock = existing?.stock || 0

    // Calculate based on transaction type
    if (txn.transaction_type === 'dc_in' || txn.transaction_type === 'dc_return') {
      stock += txn.quantity
    } else if (txn.transaction_type === 'dc_sale') {
      stock -= txn.quantity
    } else if (txn.transaction_type === 'dc_adjustment') {
      stock += txn.quantity // Can be negative
    }

    stockMap.set(txn.product_id, { product, stock: Math.max(0, stock) })
  }

  // Convert to array and filter out zero stock items
  const results: DCStockSummary[] = []
  stockMap.forEach((value, product_id) => {
    if (value.stock > 0) {
      results.push({
        product_id,
        product: value.product,
        current_stock: value.stock,
      })
    }
  })

  return results
}

/**
 * Get DC stock history for a specific product
 */
export async function getDCStockHistory(
  senderOrgId: string,
  agentUserId: string,
  productId: string
): Promise<(DCStockLedger & {
  product: Product
  delivery_challan?: {
    dc_number: string
  }
})[]> {
  const { data, error } = await supabase
    .from('dc_stock_ledger')
    .select(`
      *,
      products(*),
      delivery_challans(dc_number)
    `)
    .eq('sender_org_id', senderOrgId)
    .eq('agent_user_id', agentUserId)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data || []) as any[]).map((item: any) => ({
    ...item,
    delivery_challan: item.delivery_challans,
  })) as (DCStockLedger & {
    product: Product
    delivery_challan?: {
      dc_number: string
    }
  })[]
}

/**
 * Get all DC stock transactions (full history)
 */
export async function getAllDCStockTransactions(
  senderOrgId: string,
  agentUserId: string
): Promise<(DCStockLedger & {
  product: Product
})[]> {
  const { data, error } = await supabase
    .from('dc_stock_ledger')
    .select('*, products(*)')
    .eq('sender_org_id', senderOrgId)
    .eq('agent_user_id', agentUserId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data || []
}

/**
 * Create DC stock adjustment
 * Only agent (not helpers) can create adjustments
 */
export async function createDCStockAdjustment(
  senderOrgId: string,
  agentUserId: string,
  productId: string,
  quantity: number,
  notes: string,
  createdBy: string
): Promise<DCStockLedger> {
  const { data, error } = await supabase
    .from('dc_stock_ledger')
    .insert({
      sender_org_id: senderOrgId,
      agent_user_id: agentUserId,
      product_id: productId,
      transaction_type: 'dc_adjustment',
      quantity,
      notes,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Check DC stock availability for sale items
 */
export async function validateDCStockAvailability(
  senderOrgId: string,
  agentUserId: string,
  items: { product_id: string; quantity: number }[]
): Promise<{
  valid: boolean
  errors: { product_id: string; available: number; requested: number }[]
}> {
  const currentStock = await getDCStock(senderOrgId, agentUserId)
  
  const stockMap = new Map(
    currentStock.map(s => [s.product_id, s.current_stock])
  )

  const errors: { product_id: string; available: number; requested: number }[] = []

  for (const item of items) {
    const available = stockMap.get(item.product_id) || 0
    if (available < item.quantity) {
      errors.push({
        product_id: item.product_id,
        available,
        requested: item.quantity,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

