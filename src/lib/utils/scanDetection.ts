/**
 * Scan Detection Utility
 * Detects scan type (serial number vs product EAN) based on pattern matching
 */

export type ScanType = 'serial' | 'product_ean' | 'unknown'

/**
 * Detect scan type based on code pattern
 * - Serial: alphanumeric, 8-20 chars, flexible format
 * - Product EAN: standard EAN-13 (13 digits) or UPC-A (12 digits) format
 * - Unknown: fallback for unrecognized patterns
 */
export function detectScanType(code: string): ScanType {
  const trimmed = code.trim()

  if (!trimmed) {
    return 'unknown'
  }

  // EAN-13: exactly 13 digits
  const ean13Pattern = /^\d{13}$/
  // UPC-A: exactly 12 digits
  const upcPattern = /^\d{12}$/
  // EAN-8: exactly 8 digits (less common)
  const ean8Pattern = /^\d{8}$/

  // Check for product EAN patterns first (more specific)
  if (ean13Pattern.test(trimmed) || upcPattern.test(trimmed) || ean8Pattern.test(trimmed)) {
    return 'product_ean'
  }

  // Serial number: alphanumeric, 8-20 characters
  // More flexible format (can contain letters, numbers, hyphens, underscores)
  const serialPattern = /^[A-Za-z0-9\-_]{8,20}$/

  if (serialPattern.test(trimmed)) {
    return 'serial'
  }

  // Unknown pattern
  return 'unknown'
}

/**
 * Normalize scan code (trim whitespace, uppercase if needed)
 */
export function normalizeScanCode(code: string): string {
  return code.trim().toUpperCase()
}

/**
 * Parse multi-code input (supports newline, comma, or space separation)
 */
export function parseMultiCodes(input: string): string[] {
  return input
    .split(/[\n,\s]+/)
    .map(code => code.trim())
    .filter(code => code.length > 0)
}

