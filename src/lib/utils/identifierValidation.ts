/**
 * Identifier Validation Utilities
 * Validates and normalizes mobile numbers and GSTIN identifiers
 */

export type IdentifierType = 'mobile' | 'gstin' | 'invalid'

/**
 * Detect identifier type from input string
 * Returns 'mobile', 'gstin', or 'invalid'
 */
export function detectIdentifierType(identifier: string): IdentifierType {
  const cleaned = identifier.trim().replace(/\s+/g, '')
  
  // Check if it's a mobile number (10 digits starting with 6-9)
  if (/^[6-9][0-9]{9}$/.test(cleaned)) {
    return 'mobile'
  }
  
  // Check if it's a GSTIN (15 characters with specific pattern)
  if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleaned.toUpperCase())) {
    return 'gstin'
  }
  
  return 'invalid'
}

/**
 * Validate mobile number
 * Must be exactly 10 digits starting with 6, 7, 8, or 9
 */
export function validateMobile(mobile: string): boolean {
  const cleaned = mobile.trim().replace(/\s+/g, '')
  return /^[6-9][0-9]{9}$/.test(cleaned)
}

/**
 * Validate GSTIN format
 * Pattern: 2 digits (state) + 5 chars (PAN) + 4 digits + 1 char + 1 char + Z + 1 char
 * Optional: Mod 36 checksum validation on position 15 (not implemented yet)
 */
export function validateGSTIN(gstin: string): boolean {
  const cleaned = gstin.trim().toUpperCase().replace(/\s+/g, '')
  
  // Basic format validation
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleaned)) {
    return false
  }
  
  // TODO: Add Mod 36 checksum validation for position 15
  // For now, format validation is sufficient
  
  return true
}

/**
 * Normalize identifier based on type
 * - Mobile: Remove all non-digits, ensure 10 digits
 * - GSTIN: Uppercase, remove spaces
 */
export function normalizeIdentifier(identifier: string, type: IdentifierType): string {
  if (type === 'mobile') {
    // Remove all non-digits
    const digits = identifier.replace(/\D/g, '')
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      return digits
    }
    throw new Error('Invalid mobile number format')
  }
  
  if (type === 'gstin') {
    // Uppercase and remove spaces
    const cleaned = identifier.trim().toUpperCase().replace(/\s+/g, '')
    if (validateGSTIN(cleaned)) {
      return cleaned
    }
    throw new Error('Invalid GSTIN format')
  }
  
  throw new Error('Invalid identifier type')
}

/**
 * Get identifier display format
 * - Mobile: Format as XXX-XXX-XXXX
 * - GSTIN: Keep as-is (already formatted)
 */
export function formatIdentifier(identifier: string, type: IdentifierType): string {
  if (type === 'mobile' && identifier.length === 10) {
    return `${identifier.slice(0, 3)}-${identifier.slice(3, 6)}-${identifier.slice(6)}`
  }
  return identifier
}

