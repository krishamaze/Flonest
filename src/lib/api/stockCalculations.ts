import { supabase } from '../supabase'

/**
 * Calculate current stock for a product based on stock_ledger transactions
 * Formula: SUM(CASE WHEN type='in' THEN quantity ELSE -quantity END)
 */
export async function getCurrentStock(productId: string, orgId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('stock_ledger')
      .select('transaction_type, quantity')
      .eq('product_id', productId)
      .eq('org_id', orgId)

    if (error) {
      console.error('Error calculating stock:', error)
      return 0
    }

    if (!data || data.length === 0) {
      return 0
    }

    // Calculate: in adds, out subtracts, adjustment is relative change
    let currentStock = 0
    for (const entry of data) {
      if (entry.transaction_type === 'in') {
        currentStock += entry.quantity
      } else if (entry.transaction_type === 'out') {
        currentStock -= entry.quantity
      } else if (entry.transaction_type === 'adjustment') {
        // Adjustments are relative changes (can be positive or negative)
        // Positive = increase, Negative = decrease
        currentStock += entry.quantity
      }
    }

    return Math.max(0, currentStock) // Ensure non-negative
  } catch (error) {
    console.error('Error in getCurrentStock:', error)
    return 0
  }
}

/**
 * Get current stock for multiple products
 */
export async function getCurrentStockForProducts(
  productIds: string[],
  orgId: string
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {}

  try {
    const { data, error } = await supabase
      .from('stock_ledger')
      .select('product_id, transaction_type, quantity')
      .in('product_id', productIds)
      .eq('org_id', orgId)

    if (error) {
      console.error('Error calculating stock for products:', error)
      return {}
    }

    if (!data || data.length === 0) {
      return productIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {})
    }

    // Group by product_id and calculate stock
    const stockMap: Record<string, number> = {}
    
    // Initialize all products to 0
    productIds.forEach(id => {
      stockMap[id] = 0
    })

    // Calculate stock for each product
    data.forEach(entry => {
      if (!stockMap[entry.product_id]) {
        stockMap[entry.product_id] = 0
      }

      if (entry.transaction_type === 'in') {
        stockMap[entry.product_id] += entry.quantity
      } else if (entry.transaction_type === 'out') {
        stockMap[entry.product_id] -= entry.quantity
      } else if (entry.transaction_type === 'adjustment') {
        stockMap[entry.product_id] += entry.quantity
      }
    })

    // Ensure non-negative
    Object.keys(stockMap).forEach(id => {
      stockMap[id] = Math.max(0, stockMap[id])
    })

    return stockMap
  } catch (error) {
    console.error('Error in getCurrentStockForProducts:', error)
    return productIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {})
  }
}

/**
 * Calculate stock after a transaction (for validation and preview)
 * Returns the stock level after applying the transaction
 */
export function calculateStockAfterTransaction(
  currentStock: number,
  transactionType: 'in' | 'out' | 'adjustment',
  quantity: number
): number {
  if (transactionType === 'in') {
    return currentStock + quantity
  } else if (transactionType === 'out') {
    return currentStock - quantity
  } else {
    // Adjustment: relative change (positive = increase, negative = decrease)
    return currentStock + quantity
  }
}

