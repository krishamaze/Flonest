/**
 * GST API Utilities
 * Handles GSTIN lookup and validation
 */

export interface GSTBusinessData {
  legal_name: string
  trade_name?: string
  address: {
    building?: string
    street?: string
    city?: string
    state: string
    pincode: string
  }
  gstin_status: string
  registration_type?: string
}

/**
 * Fetch business data from GSTIN using GST API
 * 
 * ⚠️ IMPORTANT: This is a placeholder implementation.
 * 
 * Official GST API: https://developer.gst.gov.in/apiportal/
 * - Requires registration and authentication
 * - Complex OAuth flow
 * - Rate limits apply
 * 
 * Alternative options:
 * - Use third-party GST lookup services (paid)
 * - Integrate with GST portal's public APIs
 * - Use GST verification APIs from service providers
 * 
 * @param gstin - 15-character GSTIN
 * @returns Business data or null if not found/invalid
 */
export async function fetchGSTBusinessData(gstin: string): Promise<GSTBusinessData | null> {
  // Validate GSTIN format
  if (!/^[0-9A-Z]{15}$/i.test(gstin)) {
    throw new Error('Invalid GSTIN format. Must be 15 alphanumeric characters.')
  }

  // TODO: Replace with actual GST API integration
  // 
  // Example integration structure:
  // 1. Authenticate with GST API (OAuth 2.0)
  // 2. Call taxpayer search endpoint
  // 3. Parse response and map to GSTBusinessData interface
  //
  // const accessToken = await getGSTAPIAccessToken()
  // const response = await fetch(`https://api.gst.gov.in/taxpayerapi/search`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${accessToken}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({ gstin })
  // })
  // const data = await response.json()
  // return mapGSTAPIResponseToBusinessData(data)
  
  // For now, return mock data for UI development
  // GSTIN structure: 15 chars = 2 (state code) + 10 (PAN) + 1 (entity) + 1 (blank) + 1 (check digit)
  const stateCode = gstin.substring(0, 2)
  
  // Map state codes to state names (simplified - use comprehensive mapping in production)
  const stateCodeMap: Record<string, string> = {
    '27': 'Maharashtra',
    '29': 'Karnataka',
    '07': 'Delhi',
    '09': 'Haryana',
    '10': 'Himachal Pradesh',
    '03': 'Punjab',
    '08': 'Rajasthan',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
    '19': 'West Bengal',
    '33': 'Tamil Nadu',
    '32': 'Kerala',
    '24': 'Gujarat',
    '06': 'Chandigarh',
    // Add more state codes as needed
  }
  
  const state = stateCodeMap[stateCode] || 'Unknown'
  
  // Mock response - replace with actual API call
  return {
    legal_name: `Business Name (GSTIN: ${gstin})`, // TODO: Fetch from API
    trade_name: undefined,
    address: {
      building: undefined,
      street: undefined,
      city: undefined,
      state,
      pincode: '', // TODO: Fetch from API or require user input
    },
    gstin_status: 'Active', // TODO: Fetch actual status from API
    registration_type: 'Regular',
  }
}

/**
 * Validate GSTIN format
 */
export function validateGSTIN(gstin: string): boolean {
  return /^[0-9A-Z]{15}$/i.test(gstin)
}

