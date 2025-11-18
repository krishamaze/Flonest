/**
 * Standard GST Tax Slabs (India)
 * 
 * These are the standard GST rates allowed in the system.
 * Specialized rates (e.g., 3% for gold) are not included.
 */
export const STANDARD_GST_SLABS = [0, 5, 12, 18, 28] as const

export type GSTSlab = typeof STANDARD_GST_SLABS[number]

/**
 * Validate if a tax rate is a valid GST slab
 */
export function isValidGSTSlab(rate: number | null | undefined): rate is GSTSlab {
  if (rate === null || rate === undefined) return false
  return STANDARD_GST_SLABS.includes(rate as GSTSlab)
}

/**
 * Get GST slab options for Select dropdowns
 */
export function getGSTSlabOptions(): Array<{ value: string; label: string }> {
  return STANDARD_GST_SLABS.map(rate => ({
    value: rate.toString(),
    label: `${rate}%`,
  }))
}

