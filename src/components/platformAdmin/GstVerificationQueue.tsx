import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
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

export function GstVerificationQueue() {
  const { user } = useAuth()
  const [orgs, setOrgs] = useState<OrgWithVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [verifyingOrgId, setVerifyingOrgId] = useState<string | null>(null)
  const [verificationNotes, setVerificationNotes] = useState('')
  const [notesError, setNotesError] = useState<string | null>(null)
  const [gstDetailsError, setGstDetailsError] = useState<string | null>(null)
  const [parsedDetails, setParsedDetails] = useState<{
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
  }>({})

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
    const org = orgs.find(o => o.id === orgId)
    setVerifyingOrgId(orgId)
    setVerificationNotes('')
    setParsedDetails({})
    setNotesError(null)
    setGstDetailsError(null)
    
    // Auto-fill GSTIN and state if available
    if (org?.gst_number) {
      const stateCode = extractStateCodeFromGSTIN(org.gst_number)
      const stateName = stateCode ? getStateNameFromGSTCode(stateCode) : null
      setParsedDetails({
        gstin: org.gst_number,
        ...(stateName && { stateJurisdiction: stateName }),
      })
    }
  }

  /**
   * Parse GST portal result text with strict validation
   */
  const parseGstPortalResult = (text: string, expectedGstin: string): {
    parsed: typeof parsedDetails & {
      tradeName?: string
      principalAddress?: string
      coreBusinessActivity?: string
    }
    errors: string[]
    warnings: string[]
  } => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const parsed: typeof parsedDetails & {
      tradeName?: string
      principalAddress?: string
      coreBusinessActivity?: string
    } = {}
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
  const generateVerificationNotes = (parsed: typeof parsedDetails & {
    tradeName?: string
    principalAddress?: string
    coreBusinessActivity?: string
  }): string => {
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

  // Handle clipboard paste and parse GST details
  const handlePasteFromClipboard = async () => {
    if (!verifyingOrgId) return
    
    const org = orgs.find(o => o.id === verifyingOrgId)
    if (!org?.gst_number) return
    
    try {
      // Read clipboard
      const clipboardText = await navigator.clipboard.readText()
      
      if (!clipboardText.trim()) {
        setGstDetailsError('Clipboard is empty. Copy GST portal results first.')
        toast.error('Clipboard is empty. Copy GST portal results first.')
        return
      }
      
      // Parse with strict validation
      const { parsed, errors, warnings } = parseGstPortalResult(clipboardText, org.gst_number)
      
      // Show errors
      if (errors.length > 0) {
        setGstDetailsError(errors.join('. '))
        setParsedDetails({})
        setVerificationNotes('')
        setNotesError(null)
        return
      }
      
      // Clear any previous errors
      setGstDetailsError(null)
      setNotesError(null)
      
      // Show warnings
      if (warnings.length > 0) {
        warnings.forEach(warning => toast.warning(warning, { autoClose: 5000 }))
      }
      
      // Check if legal name matches org name (warning only)
      if (parsed.legalName && org.name && parsed.legalName.toLowerCase() !== org.name.toLowerCase()) {
        toast.warning(`Legal name "${parsed.legalName}" differs from org name "${org.name}"`, { autoClose: 5000 })
      }
      
      setParsedDetails(parsed)
      
      // Auto-generate verification notes from parsed data
      if (Object.keys(parsed).length > 0) {
        const notes = generateVerificationNotes(parsed)
        setVerificationNotes(notes)
      }
      
      toast.success('GST details parsed successfully')
    } catch (error: any) {
      // Handle clipboard permission errors
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        setGstDetailsError('Clipboard access denied. Please grant clipboard permission or paste manually.')
        toast.error('Clipboard access denied. Please grant clipboard permission.')
      } else {
        setGstDetailsError('Failed to read clipboard. Please ensure you have copied GST portal results.')
        toast.error('Failed to read clipboard. Please try again.')
      }
      console.error('Clipboard error:', error)
      setParsedDetails({})
      setVerificationNotes('')
    }
  }

  const handleCloseModal = () => {
    setVerifyingOrgId(null)
    setVerificationNotes('')
    setParsedDetails({})
    setNotesError(null)
    setGstDetailsError(null)
  }

  const handleMarkVerified = async () => {
    if (!verifyingOrgId || !user) return

    const org = orgs.find(o => o.id === verifyingOrgId)
    if (!org?.gst_number) return

    // Strict validation before allowing submit
    const trimmedNotes = verificationNotes.trim()
    if (!trimmedNotes) {
      setNotesError('Verification notes are required')
      return
    }

    // Minimum 50 characters ensures full data captured
    if (trimmedNotes.length < 50) {
      setNotesError('Verification notes must be at least 50 characters to ensure complete data capture')
      return
    }

    // Validate parsed details exist
    if (!parsedDetails.gstin) {
      setNotesError('Please paste GST portal results first using the "Paste from Clipboard" button')
      return
    }
    
    // Ensure parsed GSTIN matches
    if (parsedDetails.gstin.toUpperCase() !== org.gst_number.toUpperCase()) {
      setNotesError(`Parsed GSTIN (${parsedDetails.gstin}) does not match the GSTIN being verified (${org.gst_number})`)
      return
    }
    
    // Warn if status is not Active
    if (parsedDetails.status && parsedDetails.status.toLowerCase() !== 'active') {
      const proceed = window.confirm(`GSTIN status is "${parsedDetails.status}" (not Active). Do you want to proceed with verification?`)
      if (!proceed) return
    }

    setNotesError(null)

    try {
      // Use RPC function that enforces platform admin access and requires notes
      // Pass legal_name and address from parsed GST portal data
      await markGstVerified(
        verifyingOrgId,
        trimmedNotes,
        parsedDetails.legalName || null,
        parsedDetails.principalAddress || null
      )

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

      {/* Verification Modal with Structured Form */}
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
              <div>
                <p className="text-sm text-secondary-text mb-md">
                  Copy GST portal results to clipboard, then click the button below. Fields will be auto-mapped. State name is auto-filled from GSTIN.
                </p>
                
                <div className="space-y-sm">
                  <Button
                    variant="primary"
                    onClick={handlePasteFromClipboard}
                    disabled={!org}
                    className="w-full"
                  >
                    📋 Paste from Clipboard
                  </Button>
                  
                  <p className="text-xs text-muted-text">
                    Copy complete GST portal results, then click button above
                  </p>
                  
                  {/* Show error if validation failed */}
                  {gstDetailsError && (
                    <div className="rounded-lg border border-error bg-error-light px-md py-sm text-sm text-error-dark">
                      {gstDetailsError}
                    </div>
                  )}
                </div>
              </div>

              {/* Auto-filled fields preview */}
              {Object.keys(parsedDetails).length > 0 && (
                <div className="rounded-md border border-primary/20 bg-primary-light/10 p-md space-y-xs">
                  <p className="text-xs font-medium text-primary-text mb-sm">Parsed from GST Portal:</p>
                  {parsedDetails.gstin && (
                    <p className="text-xs text-secondary-text">
                      <span className="font-medium">GSTIN:</span> {parsedDetails.gstin}
                    </p>
                  )}
                  {parsedDetails.legalName && (
                    <p className="text-xs text-secondary-text">
                      <span className="font-medium">Legal Name:</span> {parsedDetails.legalName}
                      {org && parsedDetails.legalName.toLowerCase() !== org.name.toLowerCase() && (
                        <span className="text-warning ml-xs">⚠ Name mismatch with org</span>
                      )}
                    </p>
                  )}
                  {parsedDetails.tradeName && (
                    <p className="text-xs text-secondary-text">
                      <span className="font-medium">Trade Name:</span> {parsedDetails.tradeName}
                    </p>
                  )}
                  {parsedDetails.status && (
                    <p className="text-xs text-secondary-text">
                      <span className="font-medium">Status:</span> {parsedDetails.status}
                      {parsedDetails.status.toLowerCase() !== 'active' && (
                        <span className="text-warning ml-xs">⚠ Not Active</span>
                      )}
                    </p>
                  )}
                  {parsedDetails.constitution && (
                    <p className="text-xs text-secondary-text">
                      <span className="font-medium">Constitution:</span> {parsedDetails.constitution}
                    </p>
                  )}
                  {parsedDetails.taxpayerType && (
                    <p className="text-xs text-secondary-text">
                      <span className="font-medium">Taxpayer Type:</span> {parsedDetails.taxpayerType}
                    </p>
                  )}
                  {parsedDetails.registrationDate && (
                    <p className="text-xs text-secondary-text">
                      <span className="font-medium">Registration Date:</span> {parsedDetails.registrationDate}
                    </p>
                  )}
                  {parsedDetails.principalAddress && (
                    <p className="text-xs text-secondary-text">
                      <span className="font-medium">Principal Address:</span> {parsedDetails.principalAddress}
                    </p>
                  )}
                  {parsedDetails.stateJurisdiction && (
                    <p className="text-xs text-secondary-text">
                      <span className="font-medium">State Jurisdiction:</span> {parsedDetails.stateJurisdiction}
                    </p>
                  )}
                  {parsedDetails.centreJurisdiction && (
                    <p className="text-xs text-secondary-text">
                      <span className="font-medium">Centre Jurisdiction:</span> {parsedDetails.centreJurisdiction}
                    </p>
                  )}
                  {parsedDetails.coreBusinessActivity && (
                    <p className="text-xs text-secondary-text">
                      <span className="font-medium">Core Business Activity:</span> {parsedDetails.coreBusinessActivity}
                    </p>
                  )}
                </div>
              )}

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
                  placeholder="Auto-generated from parsed details. Edit as needed."
                  rows={4}
                  className="w-full rounded-md border border-neutral-200 bg-bg-card px-md py-sm text-sm text-primary-text placeholder-muted-text focus:border-primary focus:outline-2 focus:outline-primary focus:outline-offset-2 transition-base"
                />
                {notesError && (
                  <p className="mt-xs text-xs text-error">{notesError}</p>
                )}
                <p className="mt-xs text-xs text-muted-text">
                  Minimum 50 characters required to ensure complete data capture. This will be stored for audit purposes.
                </p>
              </div>

              <div className="flex gap-sm justify-between items-center pt-sm border-t border-neutral-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Future: API bulk verify button (disabled for now)
                    toast.info('Bulk API verification coming soon')
                  }}
                  className="text-xs"
                  disabled
                >
                  API Verify (Coming Soon)
                </Button>
                <div className="flex gap-sm">
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
                    disabled={!verificationNotes.trim() || verificationNotes.trim().length < 50 || !!notesError}
                  >
                    Verify GSTIN
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
