import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getCustomersByOrg,
  getCustomerById,
  updateOrgCustomer,
  lookupOrCreateCustomer,
  checkCustomerExists,
  searchCustomersByIdentifier,
  searchCustomersByPartialIdentifier,
  searchGlobalCustomers,
  addOrgCustomer,
  canDeleteCustomer,
  softDeleteCustomer,
  restoreCustomer,
  type LookupResult,
  type DeleteCheckResult,
  type DeleteResult,
  type RestoreResult,
} from '../lib/api/customers'
import type { CustomerWithMaster, CustomerSearchResult } from '../types'
import type { Database } from '../types/database'

type MasterCustomer = Database['public']['Tables']['master_customers']['Row']
type Customer = Database['public']['Tables']['customers']['Row']

/**
 * Query hook to get all customers for an organization
 */
export const useCustomers = (orgId: string | null | undefined) => {
  return useQuery<CustomerWithMaster[]>({
    queryKey: ['customers', orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organization ID is required')
      return getCustomersByOrg(orgId)
    },
    enabled: !!orgId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Query hook to get a single customer by ID
 */
export const useCustomerById = (customerId: string | null | undefined) => {
  return useQuery<CustomerWithMaster>({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      if (!customerId) throw new Error('Customer ID is required')
      return getCustomerById(customerId)
    },
    enabled: !!customerId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Query hook to check if a customer exists by identifier
 */
export const useCheckCustomerExists = (identifier: string | null | undefined, enabled: boolean = true) => {
  return useQuery<MasterCustomer | null>({
    queryKey: ['customer-exists', identifier],
    queryFn: async () => {
      if (!identifier) return null
      return checkCustomerExists(identifier)
    },
    enabled: enabled && !!identifier,
    staleTime: 10 * 1000, // 10 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Query hook to search customers by identifier for an org
 */
export const useSearchCustomersByIdentifier = (
  identifier: string | null | undefined,
  orgId: string | null | undefined,
  enabled: boolean = true
) => {
  return useQuery<CustomerWithMaster | null>({
    queryKey: ['customer-search', identifier, orgId],
    queryFn: async () => {
      if (!identifier || !orgId) return null
      return searchCustomersByIdentifier(identifier, orgId)
    },
    enabled: enabled && !!identifier && !!orgId,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Mutation hook to update org-specific customer data
 */
export const useUpdateOrgCustomer = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<
    Customer,
    Error,
    {
      customerId: string
      data: {
        alias_name?: string
        billing_address?: string
        shipping_address?: string
        notes?: string
      }
    },
    { previousCustomers: CustomerWithMaster[] | undefined; previousCustomer: CustomerWithMaster | undefined }
  >({
    mutationFn: ({ customerId, data }) => updateOrgCustomer(customerId, data),
    // Optimistic update
    onMutate: async ({ customerId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['customers', orgId] })
      await queryClient.cancelQueries({ queryKey: ['customer', customerId] })

      const previousCustomers = queryClient.getQueryData<CustomerWithMaster[]>(['customers', orgId])
      const previousCustomer = queryClient.getQueryData<CustomerWithMaster>(['customer', customerId])

      // Optimistically update customers list
      if (previousCustomers) {
        queryClient.setQueryData<CustomerWithMaster[]>(
          ['customers', orgId],
          previousCustomers.map((c) =>
            c.id === customerId ? { ...c, ...data, updated_at: new Date().toISOString() } : c
          )
        )
      }

      // Optimistically update single customer
      if (previousCustomer) {
        queryClient.setQueryData<CustomerWithMaster>(['customer', customerId], {
          ...previousCustomer,
          ...data,
          updated_at: new Date().toISOString(),
        })
      }

      return { previousCustomers, previousCustomer }
    },
    onError: (_error, { customerId }, context) => {
      // Revert on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(['customers', orgId], context.previousCustomers)
      }
      if (context?.previousCustomer) {
        queryClient.setQueryData(['customer', customerId], context.previousCustomer)
      }
    },
    onSuccess: (_, { customerId }) => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['customers', orgId] })
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] })
    },
  })
}

/**
 * Mutation hook to lookup or create a customer
 */
export const useLookupOrCreateCustomer = (orgId: string | null | undefined, userId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<
    LookupResult,
    Error,
    {
      identifier: string
      masterData?: {
        legal_name?: string
        address?: string
        email?: string
        mobile?: string
        gstin?: string
      }
    }
  >({
    mutationFn: async ({ identifier, masterData }) => {
      if (!orgId) throw new Error('Organization ID is required')
      if (!userId) throw new Error('User ID is required')
      return lookupOrCreateCustomer(identifier, orgId, userId, masterData)
    },
    onSuccess: (result) => {
      // Invalidate customers list to include the new/updated customer
      queryClient.invalidateQueries({ queryKey: ['customers', orgId] })
      // Invalidate search queries
      queryClient.invalidateQueries({ queryKey: ['customer-search'] })
      queryClient.invalidateQueries({ queryKey: ['customer-exists'] })

      // Optionally set the customer in cache
      queryClient.setQueryData<CustomerWithMaster>(['customer', result.customer.id], {
        ...result.customer,
        master_customer: result.master,
        name: result.customer.alias_name || result.master.legal_name,
        status: 'verified'
      })
    },
  })
}

/**
 * Query hook to search customers by partial identifier (autocomplete-style)
 * Searches in mobile and GSTIN fields with partial matching
 * Returns results sorted by recently invoiced, then alphabetically
 * Limit: 10 results
 * 
 * UPDATED: Now searches both Org customers and Global Master customers
 */
export const useSearchCustomersAutocomplete = (
  orgId: string | null | undefined,
  query: string | null | undefined,
  enabled: boolean = true
) => {
  return useQuery<CustomerSearchResult[]>({
    queryKey: ['customer-autocomplete', orgId, query],
    queryFn: async () => {
      if (!orgId || !query || query.trim().length < 3) return []
      
      const cleanQuery = query.trim()
      
      // Run both searches in parallel
      const [orgResults, globalResults] = await Promise.all([
        searchCustomersByPartialIdentifier(orgId, cleanQuery),
        searchGlobalCustomers(cleanQuery)
      ])

      const results: CustomerSearchResult[] = []
      const orgMasterIds = new Set<string>()

      // 1. Add Org results first
      orgResults.forEach(customer => {
        results.push({ type: 'org', data: customer })
        if (customer.master_customer_id) {
          orgMasterIds.add(customer.master_customer_id)
        }
      })

      // 2. Add Global results if not already in Org results
      globalResults.forEach(master => {
        if (!orgMasterIds.has(master.id)) {
          results.push({ type: 'global', data: master })
        }
      })

      return results
    },
    enabled: enabled && !!orgId && !!query && query.trim().length >= 3,
    staleTime: 10 * 1000, // 10 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Mutation hook to add a new org customer
 * Uses add_org_customer RPC
 */
export const useAddOrgCustomer = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<
    string, // Returns customer ID
    Error,
    {
      name: string
      mobile: string | null
      gstin: string | null
    }
  >({
    mutationFn: async ({ name, mobile, gstin }) => {
      if (!orgId) throw new Error('Organization ID is required')
      return addOrgCustomer(orgId, name, mobile, gstin)
    },
    onSuccess: () => {
      // Invalidate customers list to include the new customer
      queryClient.invalidateQueries({ queryKey: ['customers', orgId] })
      // Invalidate search queries to refresh autocomplete
      queryClient.invalidateQueries({ queryKey: ['customer-autocomplete', orgId] })
      queryClient.invalidateQueries({ queryKey: ['customer-search'] })
      queryClient.invalidateQueries({ queryKey: ['customer-exists'] })

      // Note: Return value is just the ID, caller should fetch full customer if needed
    },
  })
}

/**
 * Mutation hook to soft delete a customer
 * Optimistic update: Removes customer from cache immediately, reverts on error
 */
export const useSoftDeleteCustomer = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<DeleteResult, Error, { customerId: string }, { previousCustomers?: CustomerWithMaster[] }>({
    mutationFn: async ({ customerId }) => softDeleteCustomer(customerId),
    
    onMutate: async ({ customerId }) => {
      // Optimistic update: remove from list
      await queryClient.cancelQueries({ queryKey: ['customers', orgId] })
      const previousCustomers = queryClient.getQueryData<CustomerWithMaster[]>(['customers', orgId])
      
      if (previousCustomers) {
        queryClient.setQueryData<CustomerWithMaster[]>(
          ['customers', orgId],
          previousCustomers.filter(c => c.id !== customerId)
        )
      }
      
      return { previousCustomers }
    },
    
    onError: (_error, _variables, context) => {
      // Revert optimistic update
      if (context?.previousCustomers) {
        queryClient.setQueryData(['customers', orgId], context.previousCustomers)
      }
    },
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', orgId] })
      queryClient.invalidateQueries({ queryKey: ['customer-balances', orgId] })
    }
  })
}

/**
 * Mutation hook to restore a soft-deleted customer
 */
export const useRestoreCustomer = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<RestoreResult, Error, { customerId: string }>({
    mutationFn: async ({ customerId }) => restoreCustomer(customerId),
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', orgId] })
      queryClient.invalidateQueries({ queryKey: ['customer-balances', orgId] })
    }
  })
}

/**
 * Query hook to check if a customer can be deleted
 * Returns { can_delete: boolean, invoice_count: number }
 */
export const useCanDeleteCustomer = (customerId: string | null | undefined) => {
  return useQuery<DeleteCheckResult>({
    queryKey: ['can-delete-customer', customerId],
    queryFn: async () => {
      if (!customerId) return { can_delete: false, invoice_count: 0 }
      return canDeleteCustomer(customerId)
    },
    enabled: !!customerId,
    staleTime: 0, // Always check fresh
  })
}
