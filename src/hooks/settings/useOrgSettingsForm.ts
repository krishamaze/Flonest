import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useUpdateOrgSettings } from '../../hooks/useOrgSettings'
import type { OrgSettings } from '../../hooks/useOrgSettings'

export interface UseOrgSettingsFormReturn {
  isEditing: boolean
  setIsEditing: (editing: boolean) => void
  formData: { name: string; phone: string }
  setFormData: (data: { name: string; phone: string }) => void
  onSave: () => Promise<void>
  onCancelEdit: () => void
  isSaving: boolean
}

export function useOrgSettingsForm(
  orgId: string | null | undefined,
  orgSettings: OrgSettings | null | undefined,
  isAdmin: boolean
): UseOrgSettingsFormReturn {
  const updateSettingsMutation = useUpdateOrgSettings()

  // COPY PHASE: State copied from SettingsPage.tsx lines 28-32
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  })

  // COPY PHASE: Initialize form data effect copied from SettingsPage.tsx lines 47-54
  useEffect(() => {
    if (orgSettings && !isEditing) {
      setFormData({
        name: orgSettings.name || '',
        phone: orgSettings.phone || '',
      })
    }
  }, [orgSettings, isEditing])

  // COPY PHASE: Handlers copied from SettingsPage.tsx lines 68-94
  const handleSaveSettings = async () => {
    if (!orgId || !isAdmin) return

    try {
      // OPTIMISTIC UPDATE: Mutation updates cache immediately
      await updateSettingsMutation.mutateAsync({
        orgId,
        name: formData.name,
        phone: formData.phone || null,
      })
      toast.success('Settings saved successfully')
      setIsEditing(false)
    } catch (error: any) {
      // Error handling is done by mutation's onError (rollback happens automatically)
      toast.error(error.message || 'Failed to save settings')
    }
  }

  const handleCancelEdit = () => {
    if (orgSettings) {
      setFormData({
        name: orgSettings.name || '',
        phone: orgSettings.phone || '',
      })
    }
    setIsEditing(false)
  }

  return {
    isEditing,
    setIsEditing,
    formData,
    setFormData,
    onSave: handleSaveSettings,
    onCancelEdit: handleCancelEdit,
    isSaving: updateSettingsMutation.isPending,
  }
}
