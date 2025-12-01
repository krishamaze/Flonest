import { supabase } from '../supabase'

export interface CustomerBalance {
  customer_id: string
  customer_name: string
  mobile: string | null
  total_invoiced: number
  total_paid: number
  balance_due: number
  last_invoice_date: string | null
  invoice_count: number
}

/**
 * Get customer balances for an organization
 * Aggregates invoice data to calculate receivables
 * @param orgId Organization ID
 * @returns Array of customer balances sorted by balance_due DESC
 */
export async function getCustomerBalances(orgId: string): Promise<CustomerBalance[]> {
  const { data, error } = await supabase.rpc('get_customer_balances' as any, {
    p_org_id: orgId
  })

  if (error) {
    throw new Error(`Failed to fetch customer balances: ${error.message}`)
  }

  return (data || []).map((row: any) => ({
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    mobile: row.mobile,
    total_invoiced: Number(row.total_invoiced),
    total_paid: Number(row.total_paid),
    balance_due: Number(row.balance_due),
    last_invoice_date: row.last_invoice_date,
    invoice_count: Number(row.invoice_count)
  }))
}

/**
 * Get aggregated receivables stats for dashboard
 * @param orgId Organization ID
 * @returns Total receivables and customer count
 */
export async function getReceivablesStats(orgId: string): Promise<{
  total_receivables: number
  customers_with_balance: number
  total_invoiced: number
  collection_rate: number
}> {
  const balances = await getCustomerBalances(orgId)

  const total_receivables = balances.reduce((sum, b) => sum + b.balance_due, 0)
  const customers_with_balance = balances.filter(b => b.balance_due > 0).length
  const total_invoiced = balances.reduce((sum, b) => sum + b.total_invoiced, 0)
  const total_paid = balances.reduce((sum, b) => sum + b.total_paid, 0)
  const collection_rate = total_invoiced > 0 ? (total_paid / total_invoiced) * 100 : 0

  return {
    total_receivables,
    customers_with_balance,
    total_invoiced,
    collection_rate
  }
}
