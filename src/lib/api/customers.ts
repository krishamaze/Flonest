import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import {
  detectIdentifierType,
  normalizeIdentifier,
} from '../utils/identifierValidation'

type MasterCustomer = Database['public']['Tables']['master_customers']['Row']
type Customer = Database['public']['Tables']['customers']['Row']
type CustomerInsert = Database['public']['Tables']['customers']['Insert']
type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export interface CustomerWithMaster extends Customer {
  master_customer: MasterCustomer
}

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
    const { data: rpcData, error: rpcError } = await supabase.rpc('upsert_master_customer' as any, {
      p_mobile: type === 'mobile' ? normalized : null,
      p_gstin: type === 'gstin' ? normalized : null,
      p_legal_name: masterData?.legal_name || 'Customer',
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
  }
}

