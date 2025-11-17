/**
 * GST API Utilities
 * Handles GSTIN lookup and validation
 */
import { supabase } from '../supabase'
import { GST_STATE_CODE_MAP } from '../constants/gstStateCodes'
export interface GSTBusinessData {
  legal_name: string | null
  trade_name?: string | null
  address: {
    building?: string | null
    street?: string | null
    city?: string | null
    state: string | null
    pincode: string | null
  }
  gstin_status: string | null
  registration_type?: string | null
  verification_source?: "cashfree" | "manual"
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
  if (!validateGSTIN(gstin)) {
    throw new Error(
      "Invalid GSTIN structure. Please check the number and ensure it matches the official format.",
    )
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
 * Validate GSTIN structure (no checksum, just official format)
 *
 * Rules:
 * - 15 characters, all [0-9A-Z]
 * - First 2 characters: valid GST state code
 * - Next 10 characters: PAN pattern (5 letters, 4 digits, 1 letter)
 * - Last 3 characters: alphanumeric (already enforced by first rule)
 */
// Use shared state code map for validation
const VALID_GST_STATE_CODES = new Set<string>(Object.keys(GST_STATE_CODE_MAP))

export function validateGSTIN(gstin: string): boolean {
  const value = gstin.trim().toUpperCase()

  if (!/^[0-9A-Z]{15}$/.test(value)) return false

  const stateCode = value.slice(0, 2)
  if (!VALID_GST_STATE_CODES.has(stateCode)) return false

  const panPart = value.slice(2, 12)
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panPart)) return false

  return true
}

