import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createInvoice,
  finalizeInvoice,
  postSalesInvoice,
  cancelInvoice,
  getInvoiceById,
  getInvoicesByOrg,
  getDraftInvoiceByCustomer,
  loadDraftInvoiceData,
  validateInvoiceItems,
  revalidateDraftInvoice,
  autoSaveInvoiceDraft,
  deleteDraft,
} from '../lib/api/invoices'
import { validateScannerCodes, type ScanResult } from '../lib/api/scanner'
import { checkSerialStatus, type SerialStatus } from '../lib/api/serials'
import type { Invoice, InvoiceFormData, Org, CustomerWithMaster } from '../types'

/**
 * Query hook to get all invoices for an organization
 */
export const useInvoices = (
  orgId: string | null | undefined,
  params?: {
    status?: 'draft' | 'finalized' | 'cancelled'
    limit?: number
    offset?: number
  }
) => {
  return useQuery<Invoice[]>({
    queryKey: ['invoices', orgId, params],
    queryFn: async () => {
      if (!orgId) throw new Error('Organization ID is required')
      return getInvoicesByOrg(orgId, params)
    },
    enabled: !!orgId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Query hook to get a single invoice by ID
 */
export const useInvoice = (invoiceId: string | null | undefined) => {
  return useQuery<Invoice & { items: any[] }>({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) throw new Error('Invoice ID is required')
      return getInvoiceById(invoiceId)
    },
    enabled: !!invoiceId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Query hook to get draft invoice by customer
 */
export const useDraftInvoiceByCustomer = (
  customerId: string | null | undefined,
  orgId: string | null | undefined,
  enabled: boolean = true
) => {
  return useQuery<Invoice | null>({
    queryKey: ['draft-invoice', customerId, orgId],
    queryFn: async () => {
      if (!customerId || !orgId) return null
      return getDraftInvoiceByCustomer(customerId, orgId)
    },
    enabled: enabled && !!customerId && !!orgId,
    staleTime: 10 * 1000, // 10 seconds
    refetchOnWindowFocus: false,
  })
}

/**
 * Query hook to load draft invoice data
 */
export const useDraftInvoiceData = (invoiceId: string | null | undefined, enabled: boolean = true) => {
  return useQuery<{
    customer_id: string
    draft_session_id?: string
    items: Array<{
      product_id: string
      quantity: number
      unit_price: number
      line_total: number
      serials?: string[]
      serial_tracked?: boolean
    }>
  } | null>({
    queryKey: ['draft-invoice-data', invoiceId],
    queryFn: async () => {
      if (!invoiceId) throw new Error('Invoice ID is required')
      return loadDraftInvoiceData(invoiceId)
    },
    enabled: enabled && !!invoiceId,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Mutation hook to create an invoice
 */
export const useCreateInvoice = (orgId: string | null | undefined, userId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<
    Invoice,
    Error,
    {
      data: InvoiceFormData
      org: Org
      customer: CustomerWithMaster
    }
  >({
    mutationFn: async ({ data, org, customer }) => {
      if (!orgId) throw new Error('Organization ID is required')
      if (!userId) throw new Error('User ID is required')
      return createInvoice(orgId, userId, data, org, customer)
    },
    onSuccess: () => {
      // Invalidate invoices list
      queryClient.invalidateQueries({ queryKey: ['invoices', orgId] })
      // Invalidate draft invoice queries
      queryClient.invalidateQueries({ queryKey: ['draft-invoice'] })
      queryClient.invalidateQueries({ queryKey: ['draft-invoice-data'] })
    },
  })
}

/**
 * Mutation hook to finalize an invoice
 */
export const useFinalizeInvoice = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<Invoice, Error, string>({
    mutationFn: async (invoiceId: string) => {
      if (!orgId) throw new Error('Organization ID is required')
      return finalizeInvoice(invoiceId, orgId)
    },
    onSuccess: (_data, invoiceId) => {
      // Invalidate invoices list
      queryClient.invalidateQueries({ queryKey: ['invoices', orgId] })
      // Invalidate specific invoice
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      // Invalidate draft queries
      queryClient.invalidateQueries({ queryKey: ['draft-invoice'] })
      // Invalidate stock queries as finalizing affects inventory
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

/**
 * Mutation hook to post (finalize + record) a sales invoice
 */
export const usePostSalesInvoice = (orgId: string | null | undefined, userId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<{ success: boolean; invoice_id: string; status: string; stock_entries_created?: number }, Error, string>({
    mutationFn: async (invoiceId: string) => {
      if (!orgId) throw new Error('Organization ID is required')
      if (!userId) throw new Error('User ID is required')
      return postSalesInvoice(invoiceId, orgId, userId)
    },
    onSuccess: (_data, invoiceId) => {
      // Invalidate invoices list
      queryClient.invalidateQueries({ queryKey: ['invoices', orgId] })
      // Invalidate specific invoice
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      // Invalidate stock and products
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

/**
 * Mutation hook to cancel an invoice
 */
export const useCancelInvoice = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<Invoice, Error, string>({
    mutationFn: async (invoiceId: string) => {
      if (!orgId) throw new Error('Organization ID is required')
      return cancelInvoice(invoiceId, orgId)
    },
    onSuccess: (_data, invoiceId) => {
      // Invalidate invoices list
      queryClient.invalidateQueries({ queryKey: ['invoices', orgId] })
      // Invalidate specific invoice
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
    },
  })
}

/**
 * Mutation hook to validate invoice items
 */
export const useValidateInvoiceItems = () => {
  return useMutation<
    { valid: boolean; errors: Array<{
      item_index: number
      type: string
      message: string
      product_id?: string
      serial?: string
      available_stock?: number
      requested_quantity?: number
      master_product_id?: string
      approval_status?: string
      hsn_code?: string
    }> },
    Error,
    {
      items: any[]
      orgId: string
    }
  >({
    mutationFn: ({ items, orgId }) => validateInvoiceItems(orgId, items),
  })
}

/**
 * Mutation hook to revalidate a draft invoice
 */
export const useRevalidateDraftInvoice = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<
    { valid: boolean; errors: any[]; updated: boolean },
    Error,
    {
      invoiceId: string
    }
  >({
    mutationFn: async ({ invoiceId }) => {
      if (!orgId) throw new Error('Organization ID is required')
      return revalidateDraftInvoice(invoiceId, orgId)
    },
    onSuccess: (_data, { invoiceId }) => {
      // Invalidate specific invoice
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      // Invalidate draft invoice queries
      queryClient.invalidateQueries({ queryKey: ['draft-invoice'] })
      queryClient.invalidateQueries({ queryKey: ['draft-invoice-data', invoiceId] })
    },
  })
}

/**
 * Mutation hook to auto-save invoice draft
 */
export const useAutoSaveInvoiceDraft = (
  orgId: string | null | undefined,
  userId: string | null | undefined
) => {
  const queryClient = useQueryClient()

  return useMutation<
    { invoiceId: string; sessionId: string },
    Error,
    {
      draftId: string | null
      data: InvoiceFormData
    }
  >({
    mutationFn: async ({ draftId, data }) => {
      if (!orgId) throw new Error('Organization ID is required')
      if (!userId) throw new Error('User ID is required')
      return autoSaveInvoiceDraft(orgId, userId, draftId || '', data)
    },
    onSuccess: (_data, { draftId }) => {
      // Invalidate draft queries
      queryClient.invalidateQueries({ queryKey: ['draft-invoice'] })
      if (draftId) {
        queryClient.invalidateQueries({ queryKey: ['draft-invoice-data', draftId] })
        queryClient.invalidateQueries({ queryKey: ['invoice', draftId] })
      }
    },
  })
}

/**
 * Mutation hook to delete a draft invoice
 */
export const useDeleteDraft = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, { previousInvoices: Invoice[] | undefined }>({
    mutationFn: async (invoiceId: string) => {
      if (!orgId) throw new Error('Organization ID is required')
      return deleteDraft(invoiceId, orgId)
    },
    // Optimistic update
    onMutate: async (invoiceId) => {
      await queryClient.cancelQueries({ queryKey: ['invoices', orgId] })

      const previousInvoices = queryClient.getQueryData<Invoice[]>(['invoices', orgId])

      // Optimistically remove invoice
      if (previousInvoices) {
        queryClient.setQueryData<Invoice[]>(
          ['invoices', orgId],
          previousInvoices.filter((inv) => inv.id !== invoiceId)
        )
      }

      return { previousInvoices }
    },
    onError: (_error, _invoiceId, context) => {
      // Revert on error
      if (context?.previousInvoices) {
        queryClient.setQueryData(['invoices', orgId], context.previousInvoices)
      }
    },
    onSuccess: (_, invoiceId) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['invoices', orgId] })
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['draft-invoice'] })
      queryClient.invalidateQueries({ queryKey: ['draft-invoice-data', invoiceId] })
    },
  })
}

/**
 * Mutation hook to validate scanner codes
 */
export const useValidateScannerCodes = () => {
  return useMutation<ScanResult[], Error, { codes: string[]; orgId: string }>({
    mutationFn: ({ codes, orgId }) => validateScannerCodes(orgId, codes),
  })
}

/**
 * Mutation hook to check serial status
 */
export const useCheckSerialStatus = () => {
  return useMutation<SerialStatus, Error, { serial: string; orgId: string }>({
    mutationFn: ({ serial, orgId }) => checkSerialStatus(serial, orgId),
  })
}
