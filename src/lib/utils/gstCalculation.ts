/**
 * GST Calculation Utilities
 * Handles CGST, SGST, and IGST calculations based on seller and buyer states
 */

export interface GSTCalculationResult {
  subtotal: number
  cgst_rate: number
  sgst_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
}

/**
 * Calculate GST for an invoice
 * @param subtotal - Subtotal amount before tax
 * @param gstRate - GST rate (e.g., 18 for 18%)
 * @param sellerState - Seller's state code (2 digits)
 * @param buyerState - Buyer's state code (2 digits, from GSTIN or customer state)
 * @returns GST calculation result
 */
export function calculateGST(
  subtotal: number,
  gstRate: number,
  sellerState: string,
  buyerState?: string | null
): GSTCalculationResult {
  const taxAmount = (subtotal * gstRate) / 100

  // If buyer state is same as seller state, use CGST + SGST
  // Otherwise, use IGST
  const isSameState = buyerState && sellerState && buyerState === sellerState

  let cgst_amount = 0
  let sgst_amount = 0
  let igst_amount = 0

  if (isSameState) {
    // Same state: Split GST into CGST and SGST (50% each)
    cgst_amount = taxAmount / 2
    sgst_amount = taxAmount / 2
  } else {
    // Different state: Use IGST
    igst_amount = taxAmount
  }

  return {
    subtotal,
    cgst_rate: isSameState ? gstRate / 2 : 0,
    sgst_rate: isSameState ? gstRate / 2 : 0,
    cgst_amount: Math.round(cgst_amount * 100) / 100,
    sgst_amount: Math.round(sgst_amount * 100) / 100,
    igst_amount: Math.round(igst_amount * 100) / 100,
    total_amount: Math.round((subtotal + cgst_amount + sgst_amount + igst_amount) * 100) / 100,
  }
}

/**
 * Get GST rate from org settings or default
 * @param orgGstEnabled - Whether org has GST enabled
 * @param defaultRate - Default GST rate (default: 18%)
 * @returns GST rate percentage
 */
export function getGSTRate(orgGstEnabled: boolean, defaultRate: number = 18): number {
  if (!orgGstEnabled) {
    return 0
  }
  return defaultRate
}

/**
 * Extract state code from GSTIN
 * @param gstin - GSTIN string
 * @returns State code (first 2 digits) or null
 */
export function extractStateCodeFromGSTIN(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) {
    return null
  }
  return gstin.substring(0, 2)
}

