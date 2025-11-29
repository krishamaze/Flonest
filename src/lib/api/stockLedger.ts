import { supabase } from '../supabase'
import type { StockLedger, StockLedgerFormData, Product } from '../../types'
import type { Database } from '../../types/database'

type StockLedgerInsert = Database['public']['Tables']['stock_ledger']['Insert']

/**
 * Create a stock transaction
 * Stock is calculated from stock_ledger entries (source of truth)
 * Validation is handled in the UI before submission
 */
export async function createStockTransaction(
  orgId: string,
  userId: string,
  data: StockLedgerFormData
): Promise<StockLedger & { product: Product }> {
  // Validate product exists and belongs to org
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', data.product_id)
    .eq('org_id', orgId)
    .single()

  if (productError || !product) {
    throw new Error('Product not found or access denied')
  }

  const ledgerData: StockLedgerInsert = {
    org_id: orgId,
    product_id: data.product_id,
    transaction_type: data.transaction_type,
    quantity: data.quantity,
    notes: data.notes || null,
    created_by: userId,
  }

  const { data: ledgerEntry, error } = await supabase
    .from('stock_ledger')
    .insert([ledgerData])
    .select(`
      *,
      product:products(*)
    `)
    .single()

  if (error) {
    throw new Error(`Failed to create stock transaction: ${error.message}`)
  }

  if (!ledgerEntry || !ledgerEntry.product) {
    throw new Error('Failed to load product details for stock transaction')
  }

  return ledgerEntry as StockLedger & { product: Product }
}

/**
 * Get stock ledger entries for an organization, optionally filtered by product
 */
export async function getStockLedger(
  orgId: string,
  productId?: string
): Promise<StockLedger[]> {
  let query = supabase
    .from('stock_ledger')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (productId) {
    query = query.eq('product_id', productId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch stock ledger: ${error.message}`)
  }

  return data || []
}

/**
 * Get transaction history for a specific product
 */
export async function getStockHistory(productId: string): Promise<StockLedger[]> {
  const { data, error } = await supabase
    .from('stock_ledger')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch stock history: ${error.message}`)
  }

  return data || []
}

/**
 * Get stock ledger entries with product details
 */
export async function getStockLedgerWithProducts(
  orgId: string,
  productId?: string
): Promise<(StockLedger & { product: Product })[]> {
  let query = supabase
    .from('stock_ledger')
    .select(`
      *,
      product:products(*)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (productId) {
    query = query.eq('product_id', productId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch stock ledger: ${error.message}`)
  }

  return (data || []).map((entry: any) => ({
    ...entry,
    product: entry.product,
  }))
}

/**
 * Adjust stock level manually using the RPC
 * Supports positive (add) and negative (remove) delta
 */
export async function adjustStockLevel(
  orgId: string,
  productId: string,
  delta: number,
  notes: string
): Promise<{ success: boolean; product_id: string; delta: number }> {
  const { data, error } = await supabase.rpc('adjust_stock_level', {
    p_org_id: orgId,
    p_product_id: productId,
    p_delta_qty: delta,
    p_notes: notes,
  })

  if (error) {
    throw new Error(`Failed to adjust stock: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from adjust_stock_level')
  }

  return data as { success: boolean; product_id: string; delta: number }
}

