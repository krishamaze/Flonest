/**
 * Official GST state code to state name mapping
 * Source: GST Portal (https://www.gst.gov.in)
 * Last updated: November 2025
 * 
 * Reference:
 * - https://cleartax.in/s/gst-state-code-jurisdiction
 * - https://tallysolutions.com/gst/gst-state-code-list/
 */

export const GST_STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh', // Old code (pre-reorganization)
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh', // New code (post-reorganization)
  '38': 'Ladakh', // Added in 2020
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
}

/**
 * Extract state code (first 2 digits) from GSTIN
 * @param gstin - GSTIN string
 * @returns State code (2 digits) or null
 */
export function extractStateCodeFromGSTIN(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) {
    return null
  }
  return gstin.substring(0, 2)
}

/**
 * Get state name from GST state code
 * @param gstStateCode - 2-digit GST state code
 * @returns State name or null if code not found
 */
export function getStateNameFromGSTCode(gstStateCode: string | null | undefined): string | null {
  if (!gstStateCode) return null
  return GST_STATE_CODE_MAP[gstStateCode] || null
}

/**
 * Get state name directly from GSTIN
 * @param gstin - GSTIN string
 * @returns State name or null if GSTIN invalid or code not found
 */
export function getStateFromGSTIN(gstin: string | null | undefined): string | null {
  const code = extractStateCodeFromGSTIN(gstin)
  if (!code) return null
  return getStateNameFromGSTCode(code)
}

/**
 * Check if a state code is valid
 * @param stateCode - 2-digit state code
 * @returns true if code exists in mapping
 */
export function isValidGSTStateCode(stateCode: string | null | undefined): boolean {
  if (!stateCode) return false
  return stateCode in GST_STATE_CODE_MAP
}

