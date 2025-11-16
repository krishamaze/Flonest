import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { markGstVerified } from '../../lib/api/orgs'
import { toast } from 'react-toastify'
import type { Org } from '../../types'

interface OrgWithVerification extends Org {
  gst_verification_status: string
  gst_verification_source: string | null
  gst_verified_at: string | null
  gst_verified_by: string | null
  gst_verification_notes: string | null
}

export function GstVerificationQueue() {
  const { user } = useAuth()
  const [orgs, setOrgs] = useState<OrgWithVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [verifyingOrgId, setVerifyingOrgId] = useState<string | null>(null)
  const [verificationNotes, setVerificationNotes] = useState('')
  const [notesError, setNotesError] = useState<string | null>(null)

  useEffect(() => {
    loadQueue()
  }, [])

  const loadQueue = async () => {
    setLoading(true)
    try {
      // Include all unverified GSTINs regardless of source (manual, cashfree, secureid, etc.)
      const { data, error } = await supabase
        .from('orgs')
        .select('id, name, slug, gst_number, gst_verification_status, gst_verification_source, gst_verified_at, gst_verified_by, gst_verification_notes, created_at')
        .eq('gst_verification_status', 'unverified')
        .not('gst_number', 'is', null)
        .order('created_at', { ascending: true })

      if (error) throw error

      setOrgs((data || []) as OrgWithVerification[])
    } catch (err) {
      console.error('[GstVerificationQueue] Failed to load queue', err)
      toast.error('Failed to load verification queue')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenVerifyModal = (orgId: string) => {
    setVerifyingOrgId(orgId)
    setVerificationNotes('')
    setNotesError(null)
  }

  const handleCloseModal = () => {
    setVerifyingOrgId(null)
    setVerificationNotes('')
    setNotesError(null)
  }

  const handleMarkVerified = async () => {
    if (!verifyingOrgId || !user) return

    // Validate notes are provided
    const trimmedNotes = verificationNotes.trim()
    if (!trimmedNotes) {
      setNotesError('Verification notes are required')
      return
    }

    if (trimmedNotes.length < 10) {
      setNotesError('Please provide more detail (at least 10 characters)')
      return
    }

    setNotesError(null)

    try {
      // Use RPC function that enforces platform admin access and requires notes
      await markGstVerified(verifyingOrgId, trimmedNotes)

      toast.success('GSTIN marked as verified')
      setOrgs((prev) => prev.filter((org) => org.id !== verifyingOrgId))
      handleCloseModal()
    } catch (err: any) {
      console.error('[GstVerificationQueue] Failed to mark verified', err)
      toast.error(err.message || 'Failed to mark GSTIN as verified')
    }
  }

  const getSourceBadgeColor = (source: string | null) => {
    switch (source) {
      case 'cashfree':
        return 'bg-blue-100 text-blue-800'
      case 'secureid':
        return 'bg-purple-100 text-purple-800'
      case 'manual':
      default:
        return 'bg-neutral-100 text-neutral-800'
    }
  }

  const getSourceLabel = (source: string | null) => {
    switch (source) {
      case 'cashfree':
        return 'Cashfree'
      case 'secureid':
        return 'SecureID'
      case 'manual':
      default:
        return 'Manual'
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-md">
      <div>
        <h1 className="text-xl font-semibold text-primary-text">GSTIN Manual Verification</h1>
        <p className="mt-xs text-sm text-secondary-text">
          Review organizations with structurally valid but unverified GSTINs. Mark them as verified after checking official records (GST portal, documents, etc.).
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Pending GSTIN verifications</CardTitle>
        </CardHeader>
        <CardContent className="p-md">
          {orgs.length === 0 ? (
            <p className="text-sm text-secondary-text">No organizations are waiting for manual GSTIN verification.</p>
          ) : (
            <div className="space-y-sm">
              {orgs.map((org) => (
                <div
                  key={org.id}
                  className="flex flex-col gap-sm rounded-md border border-neutral-200 p-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-xxs flex-1">
                    <p className="text-sm font-medium text-primary-text">
                      {org.name}
                    </p>
                    <p className="text-xs text-secondary-text">
                      GSTIN: <span className="font-mono">{org.gst_number || '—'}</span>
                    </p>
                    <div className="flex items-center gap-xs flex-wrap">
                      <span className="text-xs text-muted-text">
                        Status: {org.gst_verification_status}
                      </span>
                      <span className={`text-xs px-xs py-xxs rounded-full ${getSourceBadgeColor(org.gst_verification_source)}`}>
                        {getSourceLabel(org.gst_verification_source)}
                      </span>
                      {org.created_at && (
                        <span className="text-xs text-muted-text">
                          Created: {new Date(org.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-sm">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenVerifyModal(org.id)}
                      className="min-w-[140px]"
                    >
                      Mark as verified
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Modal with Evidence Notes */}
      <Modal
        isOpen={verifyingOrgId !== null}
        onClose={handleCloseModal}
        title="Mark GSTIN as Verified"
      >
        <div className="space-y-md">
          <div>
            <p className="text-sm text-secondary-text">
              Please provide evidence/notes about how you verified this GSTIN. This will be stored for audit purposes.
            </p>
            <p className="text-xs text-muted-text mt-xs">
              Include: portal checked (e.g., GST portal), reference ID, date verified, or any other relevant details.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-text mb-xs">
              Verification Notes <span className="text-error">*</span>
            </label>
            <textarea
              value={verificationNotes}
              onChange={(e) => {
                setVerificationNotes(e.target.value)
                if (notesError) setNotesError(null)
              }}
              placeholder="Example: Verified on GST portal (gst.gov.in) on 2024-01-15. Reference: GSTIN search result shows active status. Business name matches records."
              rows={4}
              className="w-full rounded-md border border-neutral-200 bg-bg-card px-md py-sm text-sm text-primary-text placeholder-muted-text focus:border-primary focus:outline-2 focus:outline-primary focus:outline-offset-2 transition-base"
            />
            {notesError && (
              <p className="mt-xs text-xs text-error">{notesError}</p>
            )}
            <p className="mt-xs text-xs text-muted-text">
              Minimum 10 characters required. Be specific about what was checked.
            </p>
          </div>

          <div className="flex gap-sm justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCloseModal}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleMarkVerified}
              disabled={!verificationNotes.trim() || verificationNotes.trim().length < 10}
            >
              Mark as Verified
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
