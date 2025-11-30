import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import {
  detectIdentifierType,
  normalizeIdentifier,
} from '../utils/identifierValidation'
import type { CustomerWithMaster } from '../../types'

type MasterCustomer = Database['public']['Tables']['master_customers']['Row']
type Customer = Database['public']['Tables']['customers']['Row']
type CustomerInsert = Database['public']['Tables']['customers']['Insert']
type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export interface LookupResult {
  master: MasterCustomer
  customer: Customer
}

/**
 * Lookup or create customer by identifier (mobile or GSTIN)
 * Returns master customer and org-scoped customer link
 */
export async function lookupOrCreateCustomer(
  identifier: string,
  orgId: string,
  userId: string,
  masterData?: {
    legal_name?: string
    address?: string
    email?: string
    mobile?: string
    gstin?: string
  }
): Promise<LookupResult> {
  // 1. Detect type and normalize
  const type = detectIdentifierType(identifier)
  if (type === 'invalid') {
    throw new Error('Invalid identifier. Must be a 10-digit mobile number or 15-character GSTIN.')
  }

  const normalized = normalizeIdentifier(identifier, type)

  // 2. Query master_customers by identifier
  let master: MasterCustomer | null = null

  if (type === 'mobile') {
    const { data, error } = await supabase
      .from('master_customers')
      .select('*')
      .eq('mobile', normalized)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      throw new Error(`Failed to lookup master customer: ${error.message}`)
    }

    master = data || null
  } else if (type === 'gstin') {
    const { data, error } = await supabase
      .from('master_customers')
      .select('*')
      .eq('gstin', normalized)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to lookup master customer: ${error.message}`)
    }

    master = data || null
  }

  // 3. If not found, create via RPC
  let masterId: string
  if (!master) {
    // Determine which identifiers to pass
    const p_mobile = type === 'mobile' ? normalized : (masterData?.mobile || null)
    const p_gstin = type === 'gstin' ? normalized : (masterData?.gstin || null)
    
    // Use provided legal_name, or fallback to 'Customer' if we have at least one identifier
    const p_legal_name = masterData?.legal_name || (p_mobile || p_gstin ? 'Customer' : null)
    
    if (!p_legal_name) {
      throw new Error('Legal name is required to create a new customer')
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('upsert_master_customer' as any, {
      p_mobile: p_mobile as string,
      p_gstin: p_gstin as string,
      p_legal_name: p_legal_name,
      p_address: masterData?.address || null,
      p_email: masterData?.email || null,
    })

    if (rpcError) {
      throw new Error(`Failed to create master customer: ${rpcError.message}`)
    }

    if (typeof rpcData !== 'string') {
      throw new Error('RPC function returned invalid ID')
    }

    masterId = rpcData

    // Fetch the created master customer
    const { data: newMaster, error: fetchError } = await supabase
      .from('master_customers')
      .select('*')
      .eq('id', masterId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch created master customer: ${fetchError.message}`)
    }

    master = newMaster
  } else {
    masterId = master.id
    // If master exists and we have additional identifiers, update via RPC
    if (masterData?.mobile || masterData?.gstin) {
      const p_mobile = type === 'mobile' ? normalized : (masterData?.mobile || master.mobile || null)
      const p_gstin = type === 'gstin' ? normalized : (masterData?.gstin || master.gstin || null)
      
      // Only update if we're adding new identifiers
      if ((type === 'mobile' && !master.gstin && masterData?.gstin) || 
          (type === 'gstin' && !master.mobile && masterData?.mobile)) {
        await supabase.rpc('upsert_master_customer' as any, {
          p_mobile: p_mobile as string,
          p_gstin: p_gstin as string,
          p_legal_name: masterData?.legal_name || master.legal_name || 'Customer',
          p_address: masterData?.address || master.address || null,
          p_email: masterData?.email || master.email || null,
        })
        // Refetch to get updated data
        const { data: updatedMaster } = await supabase
          .from('master_customers')
          .select('*')
          .eq('id', masterId)
          .single()
        if (updatedMaster) {
          master = updatedMaster
        }
      }
    }
  }

  // 4. Ensure org link exists
  let customer = await findOrgCustomer(orgId, masterId)

  if (!customer) {
    // Create org link
    const customerData: CustomerInsert = {
      org_id: orgId,
      master_customer_id: masterId,
      created_by: userId,
    }

    const { data: newCustomer, error: createError } = await supabase
      .from('customers')
      .insert([customerData])
      .select()
      .single()

    if (createError) {
      throw new Error(`Failed to create org customer link: ${createError.message}`)
    }

    customer = newCustomer
  }

  return { master, customer }
}

/**
 * Find org-scoped customer by master customer ID
 */
async function findOrgCustomer(orgId: string, masterCustomerId: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('org_id', orgId)
    .eq('master_customer_id', masterCustomerId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to find org customer: ${error.message}`)
  }

  return data || null
}

/**
 * Get customer by ID with master customer data
 */
export async function getCustomerById(customerId: string): Promise<CustomerWithMaster> {
  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      master_customer:master_customers(*)
    `)
    .eq('id', customerId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch customer: ${error.message}`)
  }

  return data as CustomerWithMaster
}

/**
 * Update org-specific customer data
 */
export async function updateOrgCustomer(
  customerId: string,
  data: {
    alias_name?: string
    billing_address?: string
    shipping_address?: string
    notes?: string
  }
): Promise<Customer> {
  const updateData: CustomerUpdate = {
    ...data,
    updated_at: new Date().toISOString(),
  }

  // Remove undefined values
  Object.keys(updateData).forEach(key => {
    if (updateData[key as keyof CustomerUpdate] === undefined) {
      delete updateData[key as keyof CustomerUpdate]
    }
  })

  const { data: updated, error } = await supabase
    .from('customers')
    .update(updateData)
    .eq('id', customerId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update customer: ${error.message}`)
  }

  return updated
}

/**
 * Get all customers for an organization with master customer data
 */
export async function getCustomersByOrg(orgId: string): Promise<CustomerWithMaster[]> {
  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      master_customer:master_customers(*)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch customers: ${error.message}`)
  }

  return (data || []) as CustomerWithMaster[]
}

/**
 * Check if a master customer exists by identifier (mobile or GSTIN)
 * Returns the master customer if found, null otherwise
 */
export async function checkCustomerExists(identifier: string): Promise<MasterCustomer | null> {
  const type = detectIdentifierType(identifier)
  if (type === 'invalid') {
    return null
  }

  const normalized = normalizeIdentifier(identifier, type)

  if (type === 'mobile') {
    const { data, error } = await supabase
      .from('master_customers')
      .select('*')
      .eq('mobile', normalized)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      throw new Error(`Failed to check master customer: ${error.message}`)
    }

    return data || null
  } else if (type === 'gstin') {
    const { data, error } = await supabase
      .from('master_customers')
      .select('*')
      .eq('gstin', normalized)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check master customer: ${error.message}`)
    }

    return data || null
  }

  return null
}

/**
 * Search customers by identifier (mobile or GSTIN) for an org
 */
export async function searchCustomersByIdentifier(
  identifier: string,
  orgId: string
): Promise<CustomerWithMaster | null> {
  const type = detectIdentifierType(identifier)
  if (type === 'invalid') {
    return null
  }

  const normalized = normalizeIdentifier(identifier, type)

  // Query master_customers first
  let master: MasterCustomer | null = null

  if (type === 'mobile') {
    const { data } = await supabase
      .from('master_customers')
      .select('*')
      .eq('mobile', normalized)
      .single()

    master = data || null
  } else if (type === 'gstin') {
    const { data } = await supabase
      .from('master_customers')
      .select('*')
      .eq('gstin', normalized)
      .single()

    master = data || null
  }

  if (!master) {
    return null
  }

  // Find org link
  const customer = await findOrgCustomer(orgId, master.id)
  if (!customer) {
    return null
  }

  return {
    ...customer,
    master_customer: master,
  } as CustomerWithMaster
}

/**
 * Search customers by partial identifier (autocomplete-style search)
 * Searches in mobile and GSTIN fields with partial matching
 * Returns results sorted by recently invoiced (last 30 days preferred), then alphabetically
 * Limit: 10 results
 * 
 * Updated to use search_org_customers RPC for unified search
 */
export async function searchCustomersByPartialIdentifier(
  orgId: string,
  query: string
): Promise<CustomerWithMaster[]> {
  if (!query || query.trim().length < 3) {
    return []
  }

  const { data, error } = await (supabase.rpc as any)('search_org_customers', {
    p_org_id: orgId,
    p_query: query.trim()
  })

  if (error) {
    console.error('Error searching customers:', error)
    return []
  }

  // Map RPC result to CustomerWithMaster structure
  return (data || []).map((row: any) => ({
    id: row.id,
    org_id: orgId,
    master_customer_id: '', 
    name: row.name,
    alias_name: row.name,
    mobile: row.mobile,
    gst_number: row.gstin,
    status: row.status,
    last_invoice_date: row.last_invoice_date,
    created_at: null,
    updated_at: null,
    billing_address: null,
    shipping_address: null,
    created_by: null,
    state_code: null,
    tax_status: null,
    notes: null,
    master_customer: {
      id: '',
      legal_name: row.master_name || row.name,
      mobile: row.mobile,
      gstin: row.gstin,
      email: null,
      address: null,
      created_at: null,
      updated_at: null,
      last_seen_at: null,
      pan: null,
      state_code: null,
      status: 'verified'
    }
  })) as unknown as CustomerWithMaster[]
}

/**
 * Add a new org customer (with optional master link logic)
 * Uses add_org_customer RPC
 */
export async function addOrgCustomer(
  orgId: string,
  name: string,
  mobile: string | null,
  gstin: string | null
): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('add_org_customer', {
    p_org_id: orgId,
    p_name: name,
    p_mobile: mobile || null,
    p_gstin: gstin || null
  })

  if (error) {
    throw new Error(`Failed to add customer: ${error.message}`)
  }

  return data as string
}



