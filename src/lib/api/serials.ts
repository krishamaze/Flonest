import { supabase } from '../supabase'

export interface SerialStatus {
  found: boolean
  product_id?: string
  status?: string
  message?: string
}

/**
 * Check serial number status
 * Validates if a serial exists and belongs to org/product
 */
export async function checkSerialStatus(
  orgId: string,
  serialNumber: string
): Promise<SerialStatus> {
  try {
    const { data, error } = await supabase.rpc('check_serial_status', {
      p_org_id: orgId,
      p_serial_number: serialNumber,
    })

    if (error) {
      throw new Error(`Failed to check serial status: ${error.message}`)
    }

    // Parse JSONB response
    if (!data) {
      return {
        found: false,
        message: 'Serial number not found',
      }
    }

    return {
      found: data.found || false,
      product_id: data.product_id || undefined,
      status: data.status || undefined,
      message: data.message || undefined,
    }
  } catch (error) {
    console.error('Error checking serial status:', error)
    throw error
  }
}

/**
 * Reserve serials for invoice item
 * Validates serials belong to same product and are available
 */
export async function reserveSerialsForInvoice(
  invoiceItemId: string,
  serialNumbers: string[],
  orgId: string
): Promise<{ success: boolean; reserved_count: number; errors?: string[]; message: string }> {
  try {
    const { data, error } = await supabase.rpc('reserve_serials_for_invoice', {
      p_invoice_item_id: invoiceItemId,
      p_serial_numbers: serialNumbers,
      p_org_id: orgId,
    })

    if (error) {
      throw new Error(`Failed to reserve serials: ${error.message}`)
    }

    // Parse JSONB response
    if (!data) {
      return {
        success: false,
        reserved_count: 0,
        message: 'Unknown error reserving serials',
      }
    }

    return {
      success: data.success || false,
      reserved_count: data.reserved_count || 0,
      errors: data.errors || undefined,
      message: data.message || '',
    }
  } catch (error) {
    console.error('Error reserving serials:', error)
    throw error
  }
}

/**
 * Get serials for invoice item
 */
export async function getSerialsForInvoiceItem(
  invoiceItemId: string
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('invoice_item_serials')
      .select('serial_number')
      .eq('invoice_item_id', invoiceItemId)

    if (error) {
      throw new Error(`Failed to get serials for invoice item: ${error.message}`)
    }

    return (data || []).map((item) => item.serial_number)
  } catch (error) {
    console.error('Error getting serials for invoice item:', error)
    throw error
  }
}

