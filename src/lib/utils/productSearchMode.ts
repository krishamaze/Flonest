/**
 * Product Search Mode Detection Utility
 * 
 * Smart detection of input type for product search:
 * - IMEI: 15 digits, Luhn validated (mobile devices)
 * - EAN: 13 digits, standard barcode format
 * - SKU: Alphanumeric 3-20 chars
 * - NAME: Free text search
 */

export type ProductSearchMode = 'imei' | 'ean' | 'sku' | 'name'

export interface ProductSearchClassification {
  mode: ProductSearchMode
  isValid: boolean
  normalized: string
  /** For IMEI - detected category info */
  detectedCategory?: {
    name: string
    hsn_code: string
    gst_rate: number
  }
}

/**
 * Validate IMEI using Luhn algorithm
 * IMEI is 15 digits, last digit is check digit
 */
export function isValidIMEI(input: string): boolean {
  // Remove any spaces or dashes
  const cleaned = input.replace(/[\s-]/g, '')
  
  // Must be exactly 15 digits
  if (!/^\d{15}$/.test(cleaned)) return false
  
  // Luhn algorithm validation
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(cleaned[i], 10)
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  
  return sum % 10 === 0
}

/**
 * Check if input looks like an EAN barcode
 * EAN-13: 13 digits (most common)
 * EAN-8: 8 digits
 */
export function isEANFormat(input: string): boolean {
  const cleaned = input.replace(/[\s-]/g, '')
  // EAN-13 or EAN-8
  return /^\d{13}$/.test(cleaned) || /^\d{8}$/.test(cleaned)
}

/**
 * Check if input looks like a SKU
 * SKU: Alphanumeric, 3-20 characters, typically has uppercase
 */
export function isSKUFormat(input: string): boolean {
  const cleaned = input.trim()
  // SKU pattern: alphanumeric with possible dashes/underscores, 3-20 chars
  // Must have at least one letter and one number OR be all uppercase letters
  if (cleaned.length < 3 || cleaned.length > 20) return false
  if (!/^[A-Za-z0-9_-]+$/.test(cleaned)) return false
  
  // SKU typically has uppercase letters OR mix of letters and numbers
  const hasUpperCase = /[A-Z]/.test(cleaned)
  const hasNumber = /\d/.test(cleaned)
  const hasLetter = /[A-Za-z]/.test(cleaned)
  
  return (hasUpperCase && hasLetter) || (hasLetter && hasNumber)
}

/**
 * Classify product search input and return detection result
 */
export function classifyProductSearchMode(input: string): ProductSearchClassification {
  const trimmed = input.trim()
  const cleaned = trimmed.replace(/[\s-]/g, '')
  
  // Empty input
  if (!trimmed) {
    return { mode: 'name', isValid: false, normalized: '' }
  }
  
  // Check IMEI first (15 digits with Luhn validation)
  if (/^\d{15}$/.test(cleaned) && isValidIMEI(cleaned)) {
    return {
      mode: 'imei',
      isValid: true,
      normalized: cleaned,
      detectedCategory: {
        name: 'Telephones & Mobile Phones',
        hsn_code: '8517',
        gst_rate: 18
      }
    }
  }
  
  // Check EAN (13 or 8 digits)
  if (isEANFormat(cleaned)) {
    return {
      mode: 'ean',
      isValid: true,
      normalized: cleaned
    }
  }
  
  // Check SKU pattern
  if (isSKUFormat(trimmed)) {
    return {
      mode: 'sku',
      isValid: true,
      normalized: trimmed.toUpperCase()
    }
  }
  
  // Default to name search
  return {
    mode: 'name',
    isValid: true,
    normalized: trimmed
  }
}

/**
 * Format IMEI for display (with spaces for readability)
 * Example: 353456789012345 → 35-345678-901234-5
 */
export function formatIMEI(imei: string): string {
  const cleaned = imei.replace(/[\s-]/g, '')
  if (cleaned.length !== 15) return imei
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 8)}-${cleaned.slice(8, 14)}-${cleaned.slice(14)}`
}

/**
 * Get human-readable label for search mode
 */
export function getSearchModeLabel(mode: ProductSearchMode): string {
  switch (mode) {
    case 'imei': return 'IMEI (Mobile Device)'
    case 'ean': return 'Barcode (EAN)'
    case 'sku': return 'SKU'
    case 'name': return 'Product Name'
  }
}

