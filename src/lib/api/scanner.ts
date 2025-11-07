import { supabase } from '../supabase'

export interface ScanResult {
  code: string
  type: 'serialnumber' | 'productcode' | 'unknown'
  product_id?: string
  status: 'valid' | 'invalid' | 'not_found'
  message?: string
}

/**
 * Validate scanner codes (multi-barcode support)
 * Calls backend RPC to validate codes and detect types
 */
export async function validateScannerCodes(
  orgId: string,
  codes: string[]
): Promise<ScanResult[]> {
  if (!codes || codes.length === 0) {
    return []
  }

  try {
    const { data, error } = await supabase.rpc('validate_scanner_codes' as any, {
      p_org_id: orgId,
      p_codes: codes,
    })

    if (error) {
      throw new Error(`Failed to validate scanner codes: ${error.message}`)
    }

    // Parse JSONB response
    if (!data || !Array.isArray(data)) {
      return []
    }

    return data.map((item: any) => ({
      code: item.code || '',
      type: item.type || 'unknown',
      product_id: item.product_id || undefined,
      status: item.status || 'not_found',
      message: item.message || undefined,
    }))
  } catch (error) {
    console.error('Error validating scanner codes:', error)
    throw error
  }
}

