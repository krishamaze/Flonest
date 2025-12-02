/**
 * Customer search mode classification and validation
 */

export type SearchMode = 'mobile' | 'gstin' | 'name' | null

/**
 * Classify search mode based on first 3 characters
 * Returns null if not enough chars or no valid pattern
 */
export function classifySearchMode(input: string): SearchMode {
  const trimmed = input.trim()
  
  // Need at least 3 chars for classification
  if (trimmed.length < 3) return null
  
  const first3 = trimmed.substring(0, 3)
  
  // Mobile: all 3 numeric, first digit in {6,7,8,9}
  if (/^[6-9]\d{2}$/.test(first3)) {
    return 'mobile'
  }
  
  // GSTIN: first 2 digits, third is alphabet
  if (/^\d{2}[A-Z]$/i.test(first3)) {
    return 'gstin'
  }
  
  // Name: everything else (letters, mixed chars, etc)
  return 'name'
}

/**
 * Check if input is complete for the given mode
 */
export function isCompleteInput(input: string, mode: SearchMode): boolean {
  if (!mode) return false
  
  const cleaned = input.trim().replace(/\s+/g, '')
  
  if (mode === 'mobile') {
    return /^[6-9]\d{9}$/.test(cleaned) // Exactly 10 digits
  }
  
  if (mode === 'gstin') {
    return cleaned.length === 15 && 
           /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/i.test(cleaned)
  }
  
  if (mode === 'name') {
    // Names are complete at 3+ chars (only selection finalizes)
    return input.trim().length >= 3
  }
  
  return false
}
