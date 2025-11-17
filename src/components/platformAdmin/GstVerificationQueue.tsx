import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { markGstVerified } from '../../lib/api/orgs'
import { extractStateCodeFromGSTIN } from '../../lib/utils/gstCalculation'
import { toast } from 'react-toastify'
import type { Org } from '../../types'

interface OrgWithVerification extends Org {
  gst_verification_status: string
  gst_verification_source: string | null
  gst_verified_at: string | null
  gst_verified_by: string | null
  gst_verification_notes: string | null
}

/**
 * Map GST state code (2 digits) to state name
 */
function getStateNameFromGSTCode(gstStateCode: string | null): string | null {
  if (!gstStateCode) return null
  
  const stateCodeMap: Record<string, string> = {
    '33': 'Tamil Nadu',
    '27': 'Maharashtra',
    '09': 'Uttar Pradesh',
    '10': 'Delhi',
    '29': 'Karnataka',
    '24': 'Gujarat',
    '07': 'Rajasthan',
    '06': 'Haryana',
    '21': 'Odisha',
    '23': 'Madhya Pradesh',
    '18': 'West Bengal',
    '22': 'Chhattisgarh',
    '26': 'Maharashtra',
    '32': 'Telangana',
    '28': 'Kerala',
    '19': 'Assam',
    '20': 'Jharkhand',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '08': 'Rajasthan',
    '25': 'Dadra and Nagar Haveli and Daman and Diu',
    '30': 'Lakshadweep',
    '31': 'Kerala',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Ladakh',
  }
  
  return stateCodeMap[gstStateCode] || null
}

export function GstVerificationQueue() {
  const { user } = useAuth()
  const [orgs, setOrgs] = useState<OrgWithVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [verifyingOrgId, setVerifyingOrgId] = useState<string | null>(null)
  const [verificationNotes, setVerificationNotes] = useState('')
  const [notesError, setNotesError] = useState<string | null>(null)
  const [gstDetails, setGstDetails] = useState('')
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
    setGstDetails('')
    setParsedDetails({})
    setNotesError(null)
    
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

  // Auto-parse GST details from pasted text
  const handleGstDetailsChange = (value: string) => {
    setGstDetails(value)
    setNotesError(null)
    
    if (!verifyingOrgId) return
    
    const org = orgs.find(o => o.id === verifyingOrgId)
    if (!org?.gst_number) return
    
    // Parse with strict validation
    const { parsed, errors, warnings } = parseGstPortalResult(value, org.gst_number)
    
    // Show errors
    if (errors.length > 0) {
      setNotesError(errors.join('. '))
      setParsedDetails({})
      setVerificationNotes('')
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
    
    setParsedDetails(parsed)
    
    // Auto-generate verification notes from parsed data
    if (Object.keys(parsed).length > 0) {
      const notes = generateVerificationNotes(parsed)
      setVerificationNotes(notes)
    }
  }

  const handleCloseModal = () => {
    setVerifyingOrgId(null)
    setVerificationNotes('')
    setGstDetails('')
    setParsedDetails({})
    setNotesError(null)
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

    // Validate GSTIN match if details were pasted
    if (gstDetails.trim()) {
      const { parsed, errors } = parseGstPortalResult(gstDetails, org.gst_number)
      if (errors.length > 0) {
        setNotesError(errors.join('. '))
        return
      }
      
      // Ensure parsed GSTIN matches
      if (parsed.gstin && parsed.gstin.toUpperCase() !== org.gst_number.toUpperCase()) {
        setNotesError(`Parsed GSTIN (${parsed.gstin}) does not match the GSTIN being verified (${org.gst_number})`)
        return
      }
      
      // Warn if status is not Active
      if (parsed.status && parsed.status.toLowerCase() !== 'active') {
        const proceed = window.confirm(`GSTIN status is "${parsed.status}" (not Active). Do you want to proceed with verification?`)
        if (!proceed) return
      }
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

      {/* Verification Modal with Structured Form */}
      {verifyingOrgId && (() => {
        const org = orgs.find(o => o.id === verifyingOrgId)
        
        return (
          <Modal
            isOpen={verifyingOrgId !== null}
            onClose={handleCloseModal}
            title="Verify GSTIN"
          >
            <div className="space-y-md">
              <div>
                <p className="text-sm text-secondary-text mb-md">
                  Paste GST verification details below. Fields will be auto-mapped. State name is auto-filled from GSTIN.
                </p>
                
                <div>
                    <label className="block text-sm font-medium text-secondary-text mb-xs">
                      Paste GST Portal Results <span className="text-error">*</span>
                    </label>
                    <textarea
                      value={gstDetails}
                      onChange={(e) => handleGstDetailsChange(e.target.value)}
                      placeholder={`Paste complete GST portal search results. Example format:

Search Result based on GSTIN/UIN : 33CPXPK3822A2ZZ
Legal Name of Business
S KRISHNAKUMAR
Trade Name
[Trade Name]
Effective Date of registration
12/03/2020
Constitution of Business
Proprietorship
GSTIN / UIN Status
Active
Taxpayer Type
Regular
Principal Place of Business
[Address lines]
Administrative Office - JURISDICTION - STATE
[State Jurisdiction details]
Nature Of Core Business Activity
[Business activity]`}
                      rows={12}
                      className={`w-full rounded-md border px-md py-sm text-sm text-primary-text placeholder-muted-text focus:outline-2 focus:outline-primary focus:outline-offset-2 transition-base font-mono ${
                        notesError ? 'border-error focus:outline-error' : 'border-neutral-200 bg-bg-card focus:border-primary'
                      }`}
                    />
                    {notesError && (
                      <p className="mt-xs text-xs text-error">{notesError}</p>
                    )}
                    <p className="mt-xs text-xs text-muted-text">
                      Paste complete GST portal results. System will validate GSTIN match and auto-parse all fields.
                    </p>
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
              </div>
            </Modal>
          )
        })()}
    </div>
  )
}
