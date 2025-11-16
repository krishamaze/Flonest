/**
 * GST API Utilities
 * Handles GSTIN lookup and validation
 */
import { supabase } from '../supabase'
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
 * Fetch business data from GSTIN via Supabase Edge Function → Cashfree
 *
 * @param gstin - 15-character GSTIN
 * @returns Business data or null if not found/invalid
 */
export async function fetchGSTBusinessData(
  gstin: string,
): Promise<GSTBusinessData | null> {
  // Validate GSTIN format before hitting the network
  if (!/^[0-9A-Z]{15}$/i.test(gstin)) {
    throw new Error("Invalid GSTIN format. Must be 15 alphanumeric characters.")
  }

  const { data, error } = await supabase.functions.invoke<GSTBusinessData>(
    "gst-validate",
    {
      body: { gstin },
    },
  )

  if (error) {
    // Surface a clean message to the UI, but keep the low-level detail in console
    console.error("[fetchGSTBusinessData] Supabase function error", {
      message: error.message,
      name: error.name,
    })
    throw new Error(
      error.message ||
        "Unable to validate GSTIN at the moment. Please try again later.",
    )
  }

  return data ?? null
}

/**
 * Validate GSTIN format
 */
export function validateGSTIN(gstin: string): boolean {
  return /^[0-9A-Z]{15}$/i.test(gstin)
}

