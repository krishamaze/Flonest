import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { supabase } from '../../lib/supabase'
import { setGstFromValidation } from '../../lib/api/orgs'
import { fetchGSTBusinessData, validateGSTIN } from '../../lib/api/gst'
import { extractStateCodeFromGSTIN, getStateNameFromGSTCode } from '../../lib/constants/gstStateCodes'
import type { OrgSettings } from '../useOrgSettings'

export interface UseGstManagementReturn {
  gstinInput: string
  setGstinInput: (value: string) => void
  gstinLoading: boolean
  gstinError: string | null
  gstBusinessData: any
  onAddGSTIN: () => Promise<void>
}

export function useGstManagement(
  orgId: string | null | undefined,
  orgSettings: OrgSettings | null | undefined
): UseGstManagementReturn {
  const queryClient = useQueryClient()

  // COPY PHASE: State copied from SettingsPage.tsx lines 36-39
  const [gstinInput, setGstinInput] = useState('')
  const [gstinLoading, setGstinLoading] = useState(false)
  const [gstinError, setGstinError] = useState<string | null>(null)
  const [gstBusinessData, setGstBusinessData] = useState<any>(null)

  const isUnregistered = !orgSettings?.gst_number || orgSettings.gst_number.trim() === ''

  // COPY PHASE: Auto-fetch GST data effect copied from SettingsPage.tsx lines 105-127
  useEffect(() => {
    if (isUnregistered && gstinInput && validateGSTIN(gstinInput)) {
      setGstinLoading(true)
      setGstinError(null)
      fetchGSTBusinessData(gstinInput)
        .then((data) => {
          if (data) {
            setGstBusinessData(data)
          } else {
            setGstinError('GSTIN not found. Please verify and try again.')
          }
        })
        .catch((error: any) => {
          setGstinError(error.message || 'Failed to fetch GST data. Please try again.')
          setGstBusinessData(null)
        })
        .finally(() => {
          setGstinLoading(false)
        })
    } else {
      setGstBusinessData(null)
    }
  }, [gstinInput, isUnregistered])

  // COPY PHASE: Handler copied from SettingsPage.tsx lines 129-177
  const handleAddGSTIN = async () => {
    if (!orgId || !gstinInput || !validateGSTIN(gstinInput)) {
      setGstinError('Please enter a valid 15-character GSTIN')
      return
    }

    if (!gstBusinessData) {
      setGstinError('Please wait for GST data to load')
      return
    }

    setGstinLoading(true)
    setGstinError(null)

    try {
      // Update org state/pincode if needed from GST data
      const gstStateCode = extractStateCodeFromGSTIN(gstinInput)
      const stateName = gstStateCode ? getStateNameFromGSTCode(gstStateCode) : null

      if (stateName && orgSettings) {
        await supabase
          .from('orgs')
          .update({
            state: stateName,
            pincode: gstBusinessData.address.pincode || orgSettings.address || null,
          })
          .eq('id', orgId)
      }

      // Set GST number - always unverified until platform admin manually verifies
      await setGstFromValidation(
        orgId,
        gstinInput.toUpperCase(),
        true,
        'unverified',
        'manual'
      )

      toast.success('GSTIN added successfully. Awaiting platform admin verification.')
      setGstinInput('')
      setGstBusinessData(null)
      // Invalidate org settings query to refetch with new GST data
      queryClient.invalidateQueries({ queryKey: ['org-settings', orgId] })
    } catch (error: any) {
      setGstinError(error.message || 'Failed to add GSTIN. Please try again.')
    } finally {
      setGstinLoading(false)
    }
  }

  return {
    gstinInput,
    setGstinInput,
    gstinLoading,
    gstinError,
    gstBusinessData,
    onAddGSTIN: handleAddGSTIN,
  }
}
