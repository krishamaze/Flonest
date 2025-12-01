import { useMemo } from 'react'
import type { InvoiceItemFormData, Org, CustomerWithMaster, ProductWithMaster } from '../../types'
import { calculateTax, createTaxContext, productToLineItem } from '../../lib/utils/taxCalculationService'

/**
 * Hook inputs
 */
export interface UseInvoiceTaxProps {
  items: InvoiceItemFormData[]
  org: Org
  selectedCustomer: CustomerWithMaster | null
  products: ProductWithMaster[]
}

/**
 * Tax calculation result
 */
export interface InvoiceTotals {
  subtotal: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  tax_label: string
  supply_type: 'intrastate' | 'interstate' | 'exempt' | 'zero_rated'
}

/**
 * Hook outputs
 */
export interface UseInvoiceTaxReturn {
  totals: InvoiceTotals
}

/**
 * useInvoiceTax
 * 
 * Calculates invoice totals and tax breakdown using the Tax Calculation Service.
 * Handles GST-inclusive pricing with proper CGST/SGST/IGST split based on
 * customer location and org settings.
 */
export function useInvoiceTax({
  items,
  org,
  selectedCustomer,
  products,
}: UseInvoiceTaxProps): UseInvoiceTaxReturn {
  
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.line_total || 0), 0)

    // If no customer selected or no items, return zero tax
    if (!selectedCustomer || items.length === 0) {
      return {
        subtotal,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_amount: subtotal,
        tax_label: '',
        supply_type: 'exempt' as const,
      }
    }

    // Create tax calculation context using new schema fields
    const taxContext = createTaxContext(org, selectedCustomer)

    // Convert items to line items format for tax calculation
    const lineItems = items.map(item => {
      const product = products.find((p) => p.id === item.product_id) as ProductWithMaster | undefined
      // Use product.tax_rate (org-specific) if available, otherwise fallback to master_product.gst_rate
      const taxRate = product?.tax_rate ?? product?.master_product?.gst_rate ?? null
      const hsnSacCode = product?.hsn_sac_code ?? product?.master_product?.hsn_code ?? null

      return productToLineItem(
        item.line_total,
        taxRate,
        hsnSacCode
      )
    })

    // Calculate tax using new service
    const taxResult = calculateTax(taxContext, lineItems, true) // GST-inclusive pricing

    return {
      subtotal: taxResult.subtotal,
      cgst_amount: taxResult.cgst_amount,
      sgst_amount: taxResult.sgst_amount,
      igst_amount: taxResult.igst_amount,
      total_amount: taxResult.grand_total,
      tax_label: taxResult.tax_label,
      supply_type: taxResult.supply_type,
    }
  }, [items, org, selectedCustomer, products])

  return {
    totals,
  }
}
