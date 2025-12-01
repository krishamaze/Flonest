import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useOrgSwitcher } from '../components/orgs/OrgSwitcher'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

import { toast } from 'react-toastify'
import { canManageOrgSettings } from '../lib/permissions'

import {
  useOrgSettings,
  useUploadOrgLogo,
  useRemoveOrgLogo,
} from '../hooks/useOrgSettings'

import { ProfilePanel } from '../components/settings/ProfilePanel'
import { OrgSwitcherPanel } from '../components/settings/OrgSwitcherPanel'
import { OrgLogoPanel } from '../components/settings/OrgLogoPanel'
import { OrgDetailsPanel } from '../components/settings/OrgDetailsPanel'
import { BillingPanel } from '../components/settings/BillingPanel'

export function SettingsPage() {
  const { user, memberships, agentRelationships } = useAuth()
  const { openSwitcher } = useOrgSwitcher()





  const isAdmin = canManageOrgSettings(user)

  // React Query hooks - replaces manual state management
  const { data: orgSettings, isLoading: loading, error: orgSettingsError } = useOrgSettings(user?.orgId)

  const uploadLogoMutation = useUploadOrgLogo()
  const removeLogoMutation = useRemoveOrgLogo()





  // Show error toast if org settings query fails
  useEffect(() => {
    if (orgSettingsError) {
      toast.error('Failed to load settings')
    }
  }, [orgSettingsError])















  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.orgId || !isAdmin) return

    const file = e.target.files?.[0]
    if (!file) return

    try {
      // OPTIMISTIC UPDATE: Mutation updates cache after upload completes
      await uploadLogoMutation.mutateAsync({
        orgId: user.orgId,
        file,
      })
      toast.success('Logo uploaded successfully')
    } catch (error: any) {
      // Error handling is done by mutation
      toast.error(error.message || 'Failed to upload logo')
    }
  }

  const handleRemoveLogo = async () => {
    if (!user?.orgId || !isAdmin || !orgSettings?.custom_logo_url) return

    try {
      // OPTIMISTIC UPDATE: Mutation updates cache immediately
      await removeLogoMutation.mutateAsync({
        orgId: user.orgId,
      })
      toast.success('Logo removed successfully')
    } catch (error: any) {
      // Error handling is done by mutation (rollback happens automatically)
      toast.error(error.message || 'Failed to remove logo')
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-md">
        <div>
          <h1 className="text-xl font-semibold text-primary-text">Settings</h1>
          <p className="mt-xs text-sm text-secondary-text">
            Only organization admins can access settings
          </p>
        </div>
        <Card>
          <CardContent className="p-lg text-center text-secondary-text">
            You don't have permission to access this page.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-md">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-primary-text">Settings</h1>
        <p className="mt-xs text-sm text-secondary-text">
          Manage your organization profile and settings
        </p>
      </div>

      <ProfilePanel user={user} />

      <OrgSwitcherPanel
        memberships={memberships}
        agentRelationships={agentRelationships}
        onSwitch={openSwitcher}
      />

      <OrgLogoPanel
        orgSettings={orgSettings || null}
        isAdmin={isAdmin}
        isUploading={uploadLogoMutation.isPending}
        onUpload={handleLogoUpload}
        onRemove={handleRemoveLogo}
      />

      <OrgDetailsPanel
        orgSettings={orgSettings || null}
        isAdmin={isAdmin}
      />

      <BillingPanel
        orgId={user?.orgId}
        userId={user?.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}

export default SettingsPage


