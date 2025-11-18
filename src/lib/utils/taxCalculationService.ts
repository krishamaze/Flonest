/**
 * Tax Calculation Service
 * 
 * Comprehensive GST tax calculation engine for Multi-Organization Architecture
 * Handles: Intrastate (CGST+SGST), Interstate (IGST), and Zero-Rated (SEZ/Export)
 * 
 * Uses the new schema fields:
 * - org.state_code, org.tax_status
 * - customer.state_code
 * - product.tax_rate, product.hsn_sac_code
 */

import type { Org } from '../../types'
import type { CustomerWithMaster } from '../../types'

export type TaxStatus = 
  | 'registered_regular' 
  | 'registered_composition' 
  | 'sez_unit' 
  | 'sez_developer' 
  | 'unregistered' 
  | 'consumer'

export type SupplyType = 
  | 'intrastate'      // Same state → CGST + SGST
  | 'interstate'      // Different state → IGST
  | 'zero_rated'      // SEZ/Export → No tax
  | 'exempt'          // Unregistered/Consumer → No tax

export interface TaxCalculationContext {
  /** Organization context */
  org: {
    state_code: string | null
    tax_status: TaxStatus | null
    gst_number: string | null
  }
  /** Customer context */
  customer: {
    state_code: string | null
    gst_number: string | null
    tax_status: TaxStatus | null
  } | null
}

export interface LineItem {
  /** Product tax rate (0-28%) */
  tax_rate: number | null
  /** HSN/SAC code */
  hsn_sac_code: string | null
  /** Line total (GST-inclusive) */
  line_total: number
}

export interface TaxCalculationResult {
  /** Supply type determined */
  supply_type: SupplyType
  /** Tax label for invoice display */
  tax_label: string
  /** Subtotal (taxable amount) */
  subtotal: number
  /** CGST rate (%) */
  cgst_rate: number
  /** SGST rate (%) */
  sgst_rate: number
  /** IGST rate (%) */
  igst_rate: number
  /** CGST amount */
  cgst_amount: number
  /** SGST amount */
  sgst_amount: number
  /** IGST amount */
  igst_amount: number
  /** Total tax amount */
  total_tax: number
  /** Grand total */
  grand_total: number
  /** Breakdown per line item */
  line_items: Array<{
    hsn_sac_code: string | null
    taxable_amount: number
    tax_rate: number
    cgst_amount: number
    sgst_amount: number
    igst_amount: number
    total_amount: number
  }>
}

/**
 * Determine supply type based on org and customer tax status and state codes
 */
export function determineSupplyType(
  org: TaxCalculationContext['org'],
  customer: TaxCalculationContext['customer'] | null
): SupplyType {
  // Zero-rated: SEZ Unit or SEZ Developer (check both org and customer)
  if (org.tax_status === 'sez_unit' || org.tax_status === 'sez_developer') {
    return 'zero_rated'
  }
  if (customer?.tax_status === 'sez_unit' || customer?.tax_status === 'sez_developer') {
    return 'zero_rated'
  }

  // Exempt: Unregistered or Consumer
  if (org.tax_status === 'unregistered' || org.tax_status === 'consumer') {
    return 'exempt'
  }

  // Need customer state for registered orgs
  if (!customer?.state_code || !org.state_code) {
    // Default to interstate if state codes unavailable
    return 'interstate'
  }

  // Same state → Intrastate
  if (org.state_code === customer.state_code) {
    return 'intrastate'
  }

  // Different state → Interstate
  return 'interstate'
}

/**
 * Get tax label for invoice display based on supply type and tax status
 */
export function getTaxLabel(
  supply_type: SupplyType,
  org_tax_status: TaxStatus | null,
  customer_tax_status: TaxStatus | null = null
): string {
  switch (supply_type) {
    case 'zero_rated':
      // Check customer first (supply TO SEZ), then org (supply FROM SEZ)
      if (customer_tax_status === 'sez_unit') {
        return 'Supply to SEZ Unit - Without Payment of Tax'
      }
      if (customer_tax_status === 'sez_developer') {
        return 'Supply to SEZ Developer - Without Payment of Tax'
      }
      if (org_tax_status === 'sez_unit') {
        return 'Supply from SEZ Unit - Without Payment of Tax'
      }
      if (org_tax_status === 'sez_developer') {
        return 'Supply from SEZ Developer - Without Payment of Tax'
      }
      return 'Zero-Rated Supply - Without Payment of Tax'
    
    case 'exempt':
      if (org_tax_status === 'unregistered') {
        return 'Unregistered Supply - No Tax Applicable'
      }
      return 'Consumer Supply - No Tax Applicable'
    
    case 'intrastate':
      return 'Intrastate Supply - CGST + SGST'
    
    case 'interstate':
      return 'Interstate Supply - IGST'
    
    default:
      return 'Tax Calculation'
  }
}

/**
 * Calculate tax for a single line item
 */
function calculateLineItemTax(
  item: LineItem,
  supply_type: SupplyType,
  isGstInclusive: boolean = true
): {
  taxable_amount: number
  tax_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
} {
  const tax_rate = item.tax_rate || 0

  // Zero-rated or exempt: No tax
  if (supply_type === 'zero_rated' || supply_type === 'exempt' || tax_rate <= 0) {
    return {
      taxable_amount: item.line_total,
      tax_amount: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
    }
  }

  let taxable_amount: number
  let tax_amount: number

  if (isGstInclusive) {
    // Back-calculate tax from GST-inclusive price
    taxable_amount = item.line_total / (1 + tax_rate / 100)
    tax_amount = item.line_total - taxable_amount
  } else {
    // Calculate tax from GST-exclusive price
    taxable_amount = item.line_total
    tax_amount = (item.line_total * tax_rate) / 100
  }

  let cgst_amount = 0
  let sgst_amount = 0
  let igst_amount = 0

  if (supply_type === 'intrastate') {
    // Same state: Split tax into CGST and SGST (50% each)
    cgst_amount = tax_amount / 2
    sgst_amount = tax_amount / 2
  } else if (supply_type === 'interstate') {
    // Different state: Use IGST
    igst_amount = tax_amount
  }

  // Round to 2 decimals per item
  return {
    taxable_amount: Math.round(taxable_amount * 100) / 100,
    tax_amount: Math.round(tax_amount * 100) / 100,
    cgst_amount: Math.round(cgst_amount * 100) / 100,
    sgst_amount: Math.round(sgst_amount * 100) / 100,
    igst_amount: Math.round(igst_amount * 100) / 100,
  }
}

/**
 * Main tax calculation function
 * 
 * @param context - Organization and customer context
 * @param line_items - Array of line items with tax rates
 * @param isGstInclusive - Whether line totals include GST (default: true)
 * @returns Complete tax calculation result
 */
export function calculateTax(
  context: TaxCalculationContext,
  line_items: LineItem[],
  isGstInclusive: boolean = true
): TaxCalculationResult {
  // Determine supply type
  const supply_type = determineSupplyType(context.org, context.customer)
  
  // Get tax label
  const tax_label = getTaxLabel(supply_type, context.org.tax_status, context.customer?.tax_status || null)

  // Calculate per line item
  const item_calculations = line_items.map(item => {
    const item_tax = calculateLineItemTax(item, supply_type, isGstInclusive)
    
    return {
      hsn_sac_code: item.hsn_sac_code,
      taxable_amount: item_tax.taxable_amount,
      tax_rate: item.tax_rate || 0,
      cgst_amount: item_tax.cgst_amount,
      sgst_amount: item_tax.sgst_amount,
      igst_amount: item_tax.igst_amount,
      total_amount: item.line_total,
    }
  })

  // Aggregate totals
  const subtotal = item_calculations.reduce((sum, item) => sum + item.taxable_amount, 0)
  const cgst_amount = item_calculations.reduce((sum, item) => sum + item.cgst_amount, 0)
  const sgst_amount = item_calculations.reduce((sum, item) => sum + item.sgst_amount, 0)
  const igst_amount = item_calculations.reduce((sum, item) => sum + item.igst_amount, 0)
  const total_tax = cgst_amount + sgst_amount + igst_amount
  const grand_total = subtotal + total_tax

  // Determine tax rates (use highest rate from line items for display)
  const max_tax_rate = Math.max(...line_items.map(item => item.tax_rate || 0), 0)
  const cgst_rate = supply_type === 'intrastate' ? max_tax_rate / 2 : 0
  const sgst_rate = supply_type === 'intrastate' ? max_tax_rate / 2 : 0
  const igst_rate = supply_type === 'interstate' ? max_tax_rate : 0

  return {
    supply_type,
    tax_label,
    subtotal: Math.round(subtotal * 100) / 100,
    cgst_rate: Math.round(cgst_rate * 100) / 100,
    sgst_rate: Math.round(sgst_rate * 100) / 100,
    igst_rate: Math.round(igst_rate * 100) / 100,
    cgst_amount: Math.round(cgst_amount * 100) / 100,
    sgst_amount: Math.round(sgst_amount * 100) / 100,
    igst_amount: Math.round(igst_amount * 100) / 100,
    total_tax: Math.round(total_tax * 100) / 100,
    grand_total: Math.round(grand_total * 100) / 100,
    line_items: item_calculations,
  }
}

/**
 * Helper: Create tax calculation context from Org and Customer objects
 */
export function createTaxContext(
  org: Org,
  customer: CustomerWithMaster | null
): TaxCalculationContext {
  return {
    org: {
      state_code: org.state_code || null,
      tax_status: (org.tax_status as TaxStatus) || null,
      gst_number: org.gst_number || null,
    },
    customer: customer ? {
      state_code: customer.state_code || customer.master_customer?.state_code || null,
      gst_number: customer.gst_number || customer.master_customer?.gstin || null,
      tax_status: (customer.tax_status as TaxStatus) || null,
    } : null,
  }
}

/**
 * Helper: Convert product to line item format
 */
export function productToLineItem(
  line_total: number,
  tax_rate: number | null,
  hsn_sac_code: string | null
): LineItem {
  return {
    line_total,
    tax_rate: tax_rate || null,
    hsn_sac_code: hsn_sac_code || null,
  }
}

