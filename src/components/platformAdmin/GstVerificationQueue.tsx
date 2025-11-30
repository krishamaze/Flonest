import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { markGstVerified } from '../../lib/api/orgs'
import { extractStateCodeFromGSTIN, getStateNameFromGSTCode } from '../../lib/constants/gstStateCodes'
import { toast } from 'react-toastify'
import type { Org } from '../../types'

interface OrgWithVerification extends Org {
  gst_verification_status: string
  gst_verification_source: string | null
  gst_verified_at: string | null
  gst_verified_by: string | null
  gst_verification_notes: string | null
}

interface ParsedGstDetails {
  gstin?: string
  legalName?: string
  tradeName?: string
  status?: string
  constitution?: string
  taxpayerType?: string
  registrationDate?: string
  principalAddress?: string
  stateJurisdiction?: string
  centreJurisdiction?: string
  coreBusinessActivity?: string
}

export function GstVerificationQueue() {
  const [orgs, setOrgs] = useState<OrgWithVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [verifyingOrgId, setVerifyingOrgId] = useState<string | null>(null)
  const [verificationStep, setVerificationStep] = useState<'initial' | 'awaiting-paste'>('initial')
  const [verifying, setVerifying] = useState(false)
  const [gstDetailsError, setGstDetailsError] = useState<string | null>(null)

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

      setOrgs((data || []) as unknown as OrgWithVerification[])
    } catch (err) {
      console.error('[GstVerificationQueue] Failed to load queue', err)
      toast.error('Failed to load verification queue')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenVerifyModal = (orgId: string) => {
    setVerifyingOrgId(orgId)
    setVerificationStep('initial')
    setGstDetailsError(null)
    setVerifying(false)
  }

  /**
   * Parse GST portal result text with strict validation
   */
  const parseGstPortalResult = (text: string, expectedGstin: string): {
    parsed: ParsedGstDetails
    errors: string[]
    warnings: string[]
  } => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const parsed: ParsedGstDetails = {}
    const errors: string[] = []
    const warnings: string[] = []

    // First: Strict GSTIN validation
    const gstinMatch = text.match(/Search Result based on GSTIN\/UIN\s*:\s*([A-Z0-9]{15})/i)
    if (!gstinMatch) {
      errors.push('GST portal header not found. Please paste complete portal results.')
      return { parsed, errors, warnings }
    }

    const foundGstin = gstinMatch[1].toUpperCase()
    if (foundGstin !== expectedGstin.toUpperCase()) {
      errors.push(`Pasted GSTIN (${foundGstin}) does not match the GSTIN being verified (${expectedGstin})`)
      return { parsed, errors, warnings }
    }

    parsed.gstin = foundGstin

    // Parse all portal fields exactly
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Legal Name of Business
      if (line === 'Legal Name of Business' && i + 1 < lines.length) {
        parsed.legalName = lines[i + 1]
      }

      // Trade Name
      if (line === 'Trade Name' && i + 1 < lines.length) {
        parsed.tradeName = lines[i + 1]
      }

      // Effective Date of registration (DD/MM/YYYY)
      if (line === 'Effective Date of registration' && i + 1 < lines.length) {
        parsed.registrationDate = lines[i + 1]
      }

      // Constitution of Business
      if (line === 'Constitution of Business' && i + 1 < lines.length) {
        parsed.constitution = lines[i + 1]
      }

      // GSTIN / UIN Status
      if (line === 'GSTIN / UIN Status' && i + 1 < lines.length) {
        parsed.status = lines[i + 1]
      }

      // Taxpayer Type
      if (line === 'Taxpayer Type' && i + 1 < lines.length) {
        parsed.taxpayerType = lines[i + 1]
      }

      // Principal Place of Business (multi-line address)
      if (line === 'Principal Place of Business' && i + 1 < lines.length) {
        const addressLines: string[] = []
        let j = i + 1
        // Collect until next section header
        while (j < lines.length && !lines[j].match(/^(Whether|Additional|Nature|Dealing|HSN|Administrative)/)) {
          if (lines[j] && lines[j].length > 0) {
            addressLines.push(lines[j])
          }
          j++
        }
        parsed.principalAddress = addressLines.join(', ')
      }

      // Administrative Office (STATE jurisdiction)
      if (line.match(/Administrative Office.*JURISDICTION.*STATE/i) && i + 1 < lines.length) {
        const jurisdictionLines: string[] = []
        let j = i + 1
        while (j < lines.length && lines[j].match(/(State|Division|Zone|Circle)\s*-/)) {
          jurisdictionLines.push(lines[j])
          j++
        }
        parsed.stateJurisdiction = jurisdictionLines.join('; ')
      }

      // Nature Of Core Business Activity
      if (line === 'Nature Of Core Business Activity' && i + 1 < lines.length) {
        parsed.coreBusinessActivity = lines[i + 1]
      }
    }

    // Auto-fill state from GSTIN if not found in portal
    if (!parsed.stateJurisdiction && parsed.gstin) {
      const stateCode = extractStateCodeFromGSTIN(parsed.gstin)
      const stateName = stateCode ? getStateNameFromGSTCode(stateCode) : null
      if (stateName) {
        parsed.stateJurisdiction = stateName
      }
    }

    // Validation warnings
    if (parsed.status && parsed.status.toLowerCase() !== 'active') {
      warnings.push(`GSTIN status is "${parsed.status}" (not Active). Please verify.`)
    }

    return { parsed, errors, warnings }
  }

  /**
   * Generate verification notes from parsed portal data
   */
  const generateVerificationNotes = (parsed: ParsedGstDetails): string => {
    const notesParts: string[] = []
    notesParts.push(`Verified from GST Portal on ${new Date().toLocaleDateString('en-IN')}`)
    notesParts.push('')

    if (parsed.gstin) notesParts.push(`GSTIN: ${parsed.gstin}`)
    if (parsed.legalName) notesParts.push(`Legal Name: ${parsed.legalName}`)
    if (parsed.tradeName) notesParts.push(`Trade Name: ${parsed.tradeName}`)
    if (parsed.status) notesParts.push(`Status: ${parsed.status}`)
    if (parsed.constitution) notesParts.push(`Constitution: ${parsed.constitution}`)
    if (parsed.taxpayerType) notesParts.push(`Taxpayer Type: ${parsed.taxpayerType}`)
    if (parsed.registrationDate) notesParts.push(`Registration Date: ${parsed.registrationDate}`)
    if (parsed.principalAddress) notesParts.push(`Principal Address: ${parsed.principalAddress}`)
    if (parsed.stateJurisdiction) notesParts.push(`State Jurisdiction: ${parsed.stateJurisdiction}`)
    if (parsed.centreJurisdiction) notesParts.push(`Centre Jurisdiction: ${parsed.centreJurisdiction}`)
    if (parsed.coreBusinessActivity) notesParts.push(`Core Business Activity: ${parsed.coreBusinessActivity}`)

    return notesParts.join('\n')
  }

  const handleVerifyClick = async () => {
    if (!verifyingOrgId) return

    const org = orgs.find(o => o.id === verifyingOrgId)
    if (!org?.gst_number) return

    // Copy GSTIN to clipboard
    try {
      await navigator.clipboard.writeText(org.gst_number)
      toast.success('GSTIN copied to clipboard')
    } catch (err) {
      toast.error('Failed to copy GSTIN')
      return
    }

    // Open GST portal in new window
    window.open(
      'https://services.gst.gov.in/services/searchtp',
      '_blank',
      'width=1200,height=800'
    )

    // Change button state
    setVerificationStep('awaiting-paste')
  }

  const handlePasteFromClipboard = async () => {
    if (!verifyingOrgId) return

    const org = orgs.find(o => o.id === verifyingOrgId)
    if (!org?.gst_number) return

    setVerifying(true)
    setGstDetailsError(null)

    try {
      // Read clipboard
      const clipboardText = await navigator.clipboard.readText()

      if (!clipboardText.trim()) {
        setGstDetailsError('Clipboard is empty. Copy GST portal results first.')
        setVerifying(false)
        return
      }

      // Parse with strict validation
      const { parsed, errors, warnings } = parseGstPortalResult(clipboardText, org.gst_number)

      // Show errors
      if (errors.length > 0) {
        setGstDetailsError(errors.join('. '))
        setVerifying(false)
        return
      }

      // Show warnings
      if (warnings.length > 0) {
        warnings.forEach(warning => toast.warning(warning, { autoClose: 5000 }))
      }

      // Check if legal name matches org name (warning only)
      if (parsed.legalName && org.name && parsed.legalName.toLowerCase() !== org.name.toLowerCase()) {
        toast.warning(`Legal name "${parsed.legalName}" differs from org name "${org.name}"`, { autoClose: 5000 })
      }

      // Auto-generate verification notes
      const notes = generateVerificationNotes(parsed)

      // Verify immediately (no preview)
      await markGstVerified(
        verifyingOrgId,
        notes,
        parsed.legalName || null,
        parsed.principalAddress || null
      )

      toast.success('GSTIN verified successfully')
      setVerificationStep('initial')
      setVerifyingOrgId(null)

      // Refresh list
      await loadQueue()
    } catch (error: any) {
      // Handle clipboard permission errors
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        setGstDetailsError('Clipboard permission denied. Grant permission to paste.')
      } else {
        setGstDetailsError(error.message || 'Verification failed')
      }
      console.error('Verification error:', error)
    } finally {
      setVerifying(false)
    }
  }

  const handleCloseModal = () => {
    setVerifyingOrgId(null)
    setVerificationStep('initial')
    setGstDetailsError(null)
    setVerifying(false)
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

      {/* Verification Modal - Simplified Single-Button Workflow */}
      {verifyingOrgId && (() => {
        const org = orgs.find(o => o.id === verifyingOrgId)

        return (
          <Modal
            key={verifyingOrgId}
            isOpen={verifyingOrgId !== null}
            onClose={handleCloseModal}
            title="Verify GSTIN"
          >
            <div className="space-y-md">
              {/* Organization info */}
              <div className="space-y-sm bg-neutral-50 p-md rounded-lg">
                <p className="text-sm font-medium text-secondary-text">{org?.name}</p>
                <div className="flex items-center justify-between">
                  <p className="text-base font-mono text-primary-text">{org?.gst_number}</p>
                  <span className="text-xs px-sm py-xs rounded-full bg-warning-light text-warning-dark">
                    Unverified
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-xs text-sm text-secondary-text">
                <p>1. Click button below to open GST portal (GSTIN will be copied)</p>
                <p>2. Paste GSTIN in portal and solve CAPTCHA</p>
                <p>3. Copy all portal results</p>
                <p>4. Close portal window and click "Paste from Clipboard"</p>
              </div>

              {/* Error display */}
              {gstDetailsError && (
                <div className="rounded-lg border border-error bg-error-light px-md py-sm text-sm text-error-dark">
                  {gstDetailsError}
                </div>
              )}

              {/* Action button (morphs between states) */}
              {verificationStep === 'initial' ? (
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleVerifyClick}
                  disabled={!org}
                >
                  Verify GSTIN →
                </Button>
              ) : (
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handlePasteFromClipboard}
                  isLoading={verifying}
                  disabled={verifying || !org}
                >
                  📋 Paste from Clipboard
                </Button>
              )}

              <Button variant="ghost" className="w-full" onClick={handleCloseModal}>
                Cancel
              </Button>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
