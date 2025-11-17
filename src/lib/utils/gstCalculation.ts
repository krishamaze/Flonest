/**
 * GST Calculation Utilities
 * Handles CGST, SGST, and IGST calculations based on seller and buyer states
 */

import { extractStateCodeFromGSTIN } from '../constants/gstStateCodes'

export interface GSTCalculationResult {
  subtotal: number
  cgst_rate: number
  sgst_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
}

export interface ItemGSTResult {
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
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

// Re-export from constants for backward compatibility
export { extractStateCodeFromGSTIN }

/**
 * Calculate GST for a single line item (per-item calculation)
 * Supports GST-inclusive pricing (back-calculates tax from price)
 * @param lineTotal - Line item total (GST-inclusive if isGstInclusive is true)
 * @param gstRate - GST rate percentage (e.g., 18 for 18%)
 * @param sellerState - Seller's state code (2 digits)
 * @param buyerState - Buyer's state code (2 digits, from GSTIN or customer state)
 * @param isGstInclusive - Whether lineTotal includes GST (default: true)
 * @returns Item GST calculation result with rounded amounts
 */
export function calculateItemGST(
  lineTotal: number,
  gstRate: number,
  sellerState: string,
  buyerState?: string | null,
  isGstInclusive: boolean = true
): ItemGSTResult {
  if (!gstRate || gstRate <= 0) {
    return {
      taxable_amount: lineTotal,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
    }
  }

  let taxable_amount: number
  let tax_amount: number

  if (isGstInclusive) {
    // Back-calculate tax from GST-inclusive price
    // taxable_amount = lineTotal / (1 + gstRate/100)
    taxable_amount = lineTotal / (1 + gstRate / 100)
    tax_amount = lineTotal - taxable_amount
  } else {
    // Calculate tax from GST-exclusive price
    taxable_amount = lineTotal
    tax_amount = (lineTotal * gstRate) / 100
  }

  // Determine if same state or different state
  const isSameState = buyerState && sellerState && buyerState === sellerState

  let cgst_amount = 0
  let sgst_amount = 0
  let igst_amount = 0

  if (isSameState) {
    // Same state: Split tax into CGST and SGST (50% each)
    cgst_amount = tax_amount / 2
    sgst_amount = tax_amount / 2
  } else {
    // Different state (or no buyer state): Use IGST
    igst_amount = tax_amount
  }

  // Round to 2 decimals per item (critical for accurate aggregation)
  return {
    taxable_amount: Math.round(taxable_amount * 100) / 100,
    cgst_amount: Math.round(cgst_amount * 100) / 100,
    sgst_amount: Math.round(sgst_amount * 100) / 100,
    igst_amount: Math.round(igst_amount * 100) / 100,
  }
}

/**
 * Get state code from pincode (simple mapping based on first digit)
 * @param pincode - 6-digit Indian pincode
 * @returns State code (2 digits) or null
 * 
 * Note: This is a simplified implementation. For production, use a proper
 * pincode-to-state mapping API or database table.
 */
export function getStateFromPincode(pincode: string | null | undefined): string | null {
  if (!pincode || pincode.length < 1) {
    return null
  }

  // Extract first digit of pincode
  const firstDigit = pincode.charAt(0)

  // Simple mapping: First digit → approximate state code
  // This is a placeholder - should be replaced with proper mapping
  const pincodeToStateMap: Record<string, string> = {
    '1': '07', // Delhi
    '2': '09', // Haryana
    '3': '08', // Rajasthan
    '4': '27', // Maharashtra
    '5': '36', // Telangana / Andhra Pradesh
    '6': '29', // Karnataka
    '7': '19', // West Bengal
    '8': '10', // Himachal Pradesh / Punjab
    '9': '03', // Punjab / Haryana
    '0': '09', // Haryana / Delhi
  }

  return pincodeToStateMap[firstDigit] || null
}

/**
 * Get customer state code with fallback logic
 * Priority: GSTIN → pincode → default to seller state
 * @param customer - Customer object with master_customer
 * @param sellerState - Seller's state code (used as default fallback)
 * @returns Customer state code (2 digits) or seller state if unavailable
 */
export function getCustomerStateCode(
  customer: { master_customer: { gstin?: string | null; state_code?: string | null; pincode?: string | null } } | null | undefined,
  sellerState: string
): string {
  if (!customer?.master_customer) {
    return sellerState
  }

  const master = customer.master_customer

  // Priority 1: Extract from GSTIN
  if (master.gstin) {
    const stateFromGstin = extractStateCodeFromGSTIN(master.gstin)
    if (stateFromGstin) {
      return stateFromGstin
    }
  }

  // Priority 2: Use stored state_code (if available)
  if (master.state_code) {
    return master.state_code
  }

  // Priority 3: Infer from pincode
  if (master.pincode) {
    const stateFromPincode = getStateFromPincode(master.pincode)
    if (stateFromPincode) {
      return stateFromPincode
    }
  }

  // Priority 4: Default to seller state (assume same-state)
  return sellerState
}

