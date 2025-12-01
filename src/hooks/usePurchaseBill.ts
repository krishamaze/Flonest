import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import { 
  getPurchaseBillById, 
  approvePurchaseBill, 
  postPurchaseBill,
  revertPurchaseBillToDraft,
  type PurchaseBillWithItems 
} from '../lib/api/purchaseBills'
import { getOrgById } from '../lib/api/orgs'
import type { Org } from '../types'

export interface UsePurchaseBillReturn {
  // State
  bill: PurchaseBillWithItems | null
  org: Org | null
  loading: boolean
  actionLoading: boolean
  error: string | null

  // Actions
  loadBill: () => Promise<void>
  approveBill: () => Promise<void>
  postBill: () => Promise<void>
  revertToDraft: () => Promise<void>
}

export function usePurchaseBill(
  billId: string, 
  orgId: string, 
  userId: string
): UsePurchaseBillReturn {
  const [bill, setBill] = useState<PurchaseBillWithItems | null>(null)
  const [org, setOrg] = useState<Org | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBill = useCallback(async () => {
    if (!billId || !orgId) return

    try {
      setLoading(true)
      setError(null)

      const [billData, orgData] = await Promise.all([
        getPurchaseBillById(billId, orgId),
        getOrgById(orgId),
      ])

      setBill(billData)
      setOrg(orgData)
    } catch (err) {
      console.error('Error loading purchase bill:', err)
      setError(err instanceof Error ? err.message : 'Failed to load purchase bill')
    } finally {
      setLoading(false)
    }
  }, [billId, orgId])

  // Initial load
  useEffect(() => {
    loadBill()
  }, [loadBill])

  // APPROVE ACTION: draft → approved
  const approveBill = async () => {
    if (!bill || bill.status !== 'draft') return

    try {
      setActionLoading(true)
      setError(null)
      
      const approvedBill = await approvePurchaseBill(billId, orgId, userId)
      setBill(approvedBill)
      toast.success('Purchase bill approved successfully')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve purchase bill'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setActionLoading(false)
    }
  }

  // POST ACTION: approved → posted (calls RPC)
  const postBill = async () => {
    if (!bill || bill.status !== 'approved') return

    try {
      setActionLoading(true)
      setError(null)
      
      const postedBill = await postPurchaseBill(billId, orgId, userId)
      setBill(postedBill)
      toast.success('Purchase bill posted to inventory successfully')
    } catch (err) {
      // Error message is already translated by getUserFriendlyError in API
      const errorMessage = err instanceof Error ? err.message : 'Failed to post purchase bill'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setActionLoading(false)
    }
  }

  // REVERT ACTION: flagged_hsn_mismatch → draft
  const revertToDraft = async () => {
    if (!bill || bill.status !== 'flagged_hsn_mismatch') return

    try {
      setActionLoading(true)
      setError(null)
      
      const revertedBill = await revertPurchaseBillToDraft(billId, orgId)
      setBill(revertedBill)
      toast.success('Bill reverted to draft. You can now edit items and correct HSN codes.')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revert bill to draft'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setActionLoading(false)
    }
  }

  return {
    bill,
    org,
    loading,
    actionLoading,
    error,
    loadBill,
    approveBill,
    postBill,
    revertToDraft
  }
}
