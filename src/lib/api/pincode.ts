/**
 * Pincode API Utilities
 * Handles pincode lookup and address data fetching
 */

export interface PincodeData {
  state: string
  district: string
  city: string
  postOffice: string
  circle: string
  region: string
  division: string
  block?: string
}

/**
 * Fetch address data from pincode using PostalPinCode.in API
 * 
 * @param pincode - 6-digit Indian pincode
 * @returns Pincode data or null if not found/invalid
 */
export async function fetchPincodeData(pincode: string): Promise<PincodeData | null> {
  // Validate pincode format
  if (!/^\d{6}$/.test(pincode)) {
    return null
  }

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.Status === 'Success' && data.PostOffice && data.PostOffice.length > 0) {
      // Use first post office result (most common case)
      const office = data.PostOffice[0]
      
      return {
        state: office.State || '',
        district: office.District || '',
        city: office.Name || office.District || '', // Post office name often represents city/area
        postOffice: office.Name || '',
        circle: office.Circle || '',
        region: office.Region || '',
        division: office.Division || '',
        block: office.Block || undefined,
      }
    }

    return null
  } catch (error) {
    console.error('Pincode lookup failed:', error)
    // Return null on error - user can still proceed manually
    return null
  }
}

/**
 * Validate pincode format
 */
export function validatePincode(pincode: string): boolean {
  return /^\d{6}$/.test(pincode)
}

