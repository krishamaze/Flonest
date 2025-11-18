/**
 * useBillCalculations Hook
 * 
 * Real-time bill calculation engine for Indian GST compliance.
 * Determines Place of Supply and calculates taxes correctly:
 * - Intra-state (Local): Vendor State == Org State → CGST + SGST (Split tax rate)
 * - Inter-state (Central): Vendor State ≠ Org State → IGST (Full tax rate)
 * 
 * This hook is purely functional (deterministic) and easily unit-testable.
 */

export interface BillItem {
  /** Line total amount (GST-inclusive) */
  line_total: number
  /** Tax rate percentage (0-28%) */
  tax_rate: number | null
  /** HSN/SAC code */
  hsn_sac_code?: string | null
}

export interface BillCalculationResult {
  /** Subtotal (taxable amount before tax) */
  subtotal: number
  /** Total tax amount */
  totalTax: number
  /** Tax breakdown by rate */
  taxBreakdown: Map<number, TaxBreakdownItem>
  /** Grand total (subtotal + tax) */
  grandTotal: number
  /** Place of Supply type */
  placeOfSupply: 'intrastate' | 'interstate'
  /** CGST amount (for intrastate) */
  cgstAmount: number
  /** SGST amount (for intrastate) */
  sgstAmount: number
  /** IGST amount (for interstate) */
  igstAmount: number
}

export interface TaxBreakdownItem {
  /** Tax rate percentage */
  rate: number
  /** Taxable amount at this rate */
  taxableAmount: number
  /** CGST amount at this rate */
  cgstAmount: number
  /** SGST amount at this rate */
  sgstAmount: number
  /** IGST amount at this rate */
  igstAmount: number
  /** Total tax amount at this rate */
  taxAmount: number
}

/**
 * Determine Place of Supply based on org state and vendor state
 * 
 * @param orgState - Organization state code (2-digit) or state name
 * @param vendorState - Vendor state code (2-digit) or state name
 * @returns 'intrastate' if same state, 'interstate' if different states
 */
export function determinePlaceOfSupply(
  orgState: string | null | undefined,
  vendorState: string | null | undefined
): 'intrastate' | 'interstate' {
  // If either state is missing, default to interstate (safer for compliance)
  if (!orgState || !vendorState) {
    return 'interstate'
  }

  // Normalize states (handle both state codes and state names)
  const normalizeState = (state: string): string => {
    // If it's a 2-digit code, return as-is
    if (/^\d{2}$/.test(state.trim())) {
      return state.trim()
    }
    // Otherwise, normalize state name (case-insensitive)
    return state.trim().toLowerCase()
  }

  const orgStateNormalized = normalizeState(orgState)
  const vendorStateNormalized = normalizeState(vendorState)

  // Compare normalized states
  return orgStateNormalized === vendorStateNormalized ? 'intrastate' : 'interstate'
}

/**
 * Calculate tax for a single line item
 * 
 * @param item - Line item with tax rate and amount
 * @param placeOfSupply - Place of Supply type
 * @param isGstInclusive - Whether line_total includes GST (default: true)
 * @returns Tax calculation for the line item
 */
function calculateLineItemTax(
  item: BillItem,
  placeOfSupply: 'intrastate' | 'interstate',
  isGstInclusive: boolean = true
): {
  taxableAmount: number
  taxAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
} {
  const taxRate = item.tax_rate || 0

  // No tax if rate is 0 or negative
  if (taxRate <= 0) {
    return {
      taxableAmount: item.line_total,
      taxAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
    }
  }

  let taxableAmount: number
  let taxAmount: number

  if (isGstInclusive) {
    // Back-calculate tax from GST-inclusive price
    // Formula: taxable_amount = line_total / (1 + tax_rate / 100)
    taxableAmount = item.line_total / (1 + taxRate / 100)
    taxAmount = item.line_total - taxableAmount
  } else {
    // Calculate tax from GST-exclusive price
    taxableAmount = item.line_total
    taxAmount = (item.line_total * taxRate) / 100
  }

  let cgstAmount = 0
  let sgstAmount = 0
  let igstAmount = 0

  if (placeOfSupply === 'intrastate') {
    // Same state: Split tax into CGST and SGST (50% each)
    cgstAmount = taxAmount / 2
    sgstAmount = taxAmount / 2
  } else {
    // Different state: Use IGST (full tax rate)
    igstAmount = taxAmount
  }

  // Round to 2 decimals per item
  return {
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    cgstAmount: Math.round(cgstAmount * 100) / 100,
    sgstAmount: Math.round(sgstAmount * 100) / 100,
    igstAmount: Math.round(igstAmount * 100) / 100,
  }
}

/**
 * Calculate bill totals with GST
 * 
 * @param items - Array of line items
 * @param orgState - Organization state code or name
 * @param vendorState - Vendor state code or name
 * @param isGstInclusive - Whether line totals include GST (default: true)
 * @returns Complete bill calculation result
 */
export function calculateBillTotals(
  items: BillItem[],
  orgState: string | null | undefined,
  vendorState: string | null | undefined,
  isGstInclusive: boolean = true
): BillCalculationResult {
  // Determine Place of Supply
  const placeOfSupply = determinePlaceOfSupply(orgState, vendorState)

  // Calculate tax per line item
  const itemCalculations = items.map(item => {
    const itemTax = calculateLineItemTax(item, placeOfSupply, isGstInclusive)
    return {
      ...itemTax,
      taxRate: item.tax_rate || 0,
    }
  })

  // Group by tax rate for breakdown
  const taxBreakdown = new Map<number, TaxBreakdownItem>()

  itemCalculations.forEach((calc) => {
    const rate = calc.taxRate
    const existing = taxBreakdown.get(rate) || {
      rate,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxAmount: 0,
    }

    taxBreakdown.set(rate, {
      rate,
      taxableAmount: existing.taxableAmount + calc.taxableAmount,
      cgstAmount: existing.cgstAmount + calc.cgstAmount,
      sgstAmount: existing.sgstAmount + calc.sgstAmount,
      igstAmount: existing.igstAmount + calc.igstAmount,
      taxAmount: existing.taxAmount + calc.taxAmount,
    })
  })

  // Aggregate totals
  const subtotal = itemCalculations.reduce((sum, calc) => sum + calc.taxableAmount, 0)
  const cgstAmount = itemCalculations.reduce((sum, calc) => sum + calc.cgstAmount, 0)
  const sgstAmount = itemCalculations.reduce((sum, calc) => sum + calc.sgstAmount, 0)
  const igstAmount = itemCalculations.reduce((sum, calc) => sum + calc.igstAmount, 0)
  const totalTax = cgstAmount + sgstAmount + igstAmount
  const grandTotal = subtotal + totalTax

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    taxBreakdown,
    grandTotal: Math.round(grandTotal * 100) / 100,
    placeOfSupply,
    cgstAmount: Math.round(cgstAmount * 100) / 100,
    sgstAmount: Math.round(sgstAmount * 100) / 100,
    igstAmount: Math.round(igstAmount * 100) / 100,
  }
}

/**
 * React hook for real-time bill calculations
 * 
 * @param items - Array of line items
 * @param orgState - Organization state code or name
 * @param vendorState - Vendor state code or name
 * @param isGstInclusive - Whether line totals include GST (default: true)
 * @returns Bill calculation result
 */
export function useBillCalculations(
  items: BillItem[],
  orgState: string | null | undefined,
  vendorState: string | null | undefined,
  isGstInclusive: boolean = true
): BillCalculationResult {
  return calculateBillTotals(items, orgState, vendorState, isGstInclusive)
}


