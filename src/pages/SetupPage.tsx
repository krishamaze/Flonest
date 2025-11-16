import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { StepIndicator } from '../components/ui/StepIndicator'
import { supabase } from '../lib/supabase'
import { updateOrg, generateUniqueSlug, setGstFromValidation } from '../lib/api/orgs'
import { fetchGSTBusinessData, validateGSTIN } from '../lib/api/gst'
import { fetchPincodeData, validatePincode } from '../lib/api/pincode'
import { toast } from 'react-toastify'
import type { Org } from '../types'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

type SetupStep = 'gst_check' | 'gst_input' | 'gst_review' | 'non_gst_form'

interface GSTBusinessData {
  legal_name: string | null
  trade_name?: string | null
  address: {
    building?: string | null
    street?: string | null
    city?: string | null
    state: string | null
    pincode: string | null
  }
  gstin_status: string | null
  registration_type?: string | null
  verification_source?: "cashfree" | "manual"
}

interface NonGSTFormData {
  business_name: string
  pincode: string
  state: string
  district: string
  address_line_1: string
  address_line_2: string
  contact_person: string
  contact: string
}

export function SetupPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const [org, setOrg] = useState<Org | null>(null)
  const [orgLoading, setOrgLoading] = useState(true)
  
  // Step management
  const [currentStep, setCurrentStep] = useState<SetupStep>('gst_check')
  const [isGSTRegistered, setIsGSTRegistered] = useState<boolean | null>(null)
  
  // GST flow data
  const [gstin, setGstin] = useState('')
  const [gstLoading, setGstLoading] = useState(false)
  const [gstBusinessData, setGstBusinessData] = useState<GSTBusinessData | null>(null)
  
  // Non-GST flow data
  const [nonGSTFormData, setNonGSTFormData] = useState<NonGSTFormData>({
    business_name: '',
    pincode: '',
    state: '',
    district: '',
    address_line_1: '',
    address_line_2: '',
    contact_person: '',
    contact: '',
  })
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [nonGSTErrors, setNonGSTErrors] = useState<Partial<Record<keyof NonGSTFormData, string>>>({})
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch org data and check if setup is needed
  useEffect(() => {
    if (!authLoading && user?.orgId && !user.platformAdmin) {
      supabase
        .from('orgs')
        .select('*')
        .eq('id', user.orgId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching org:', error)
            toast.error('Failed to load organization data')
            navigate('/')
            return
          }

          if (!data) {
            navigate('/')
            return
          }

          if (data.state !== 'Default') {
            navigate('/', { replace: true })
            return
          }

          setOrg(data)
          setOrgLoading(false)
        })
    } else if (!authLoading) {
      navigate('/')
    }
  }, [user?.orgId, user?.platformAdmin, authLoading, navigate])

  // Auto-fetch pincode data for non-GST flow
  useEffect(() => {
    if (currentStep === 'non_gst_form' && validatePincode(nonGSTFormData.pincode)) {
      setPincodeLoading(true)
      fetchPincodeData(nonGSTFormData.pincode)
        .then((data) => {
          if (data) {
            setNonGSTFormData(prev => ({
              ...prev,
              state: data.state,
              district: data.district,
            }))
          }
        })
        .catch((error) => {
          console.error('Pincode lookup failed:', error)
        })
        .finally(() => {
          setPincodeLoading(false)
        })
    }
  }, [nonGSTFormData.pincode, currentStep])

  // Auto-fetch GST data when GSTIN is complete
  useEffect(() => {
    if (currentStep === 'gst_input' && validateGSTIN(gstin)) {
      setGstLoading(true)
      fetchGSTBusinessData(gstin)
        .then((data) => {
          if (data) {
            setGstBusinessData(data)
            setCurrentStep('gst_review')
          } else {
            toast.error('GSTIN not found. Please verify and try again.')
          }
        })
        .catch((error: any) => {
          toast.error(error.message || 'Failed to fetch GST data. Please try again.')
        })
        .finally(() => {
          setGstLoading(false)
        })
    }
  }, [gstin, currentStep])

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error: any) {
      console.error('Logout error:', error)
      toast.error('Failed to logout. Please try again.')
    }
  }

  const handleGSTCheckContinue = () => {
    if (isGSTRegistered === true) {
      setCurrentStep('gst_input')
    } else if (isGSTRegistered === false) {
      setCurrentStep('non_gst_form')
    }
  }

  const handleGSTReviewConfirm = async () => {
    if (!gstBusinessData || !user?.orgId || !org) return

    setIsSubmitting(true)
    try {
      const slug = await generateUniqueSlug(gstBusinessData.legal_name, user.orgId)
      
      // Update org name/state/pincode/slug via updateOrg
      await updateOrg(user.orgId, {
        name: gstBusinessData.legal_name || org.name,
        state: gstBusinessData.address.state || org.state,
        pincode: gstBusinessData.address.pincode || org.pincode || '',
        slug,
      })
      
      // Set GST number and verification status from gst-validate response via RPC
      // This is the only way tenant code can set verification fields - they must come from gst-validate
      await setGstFromValidation(
        user.orgId,
        gstin.toUpperCase(),
        true,
        (gstBusinessData.gstin_status === 'verified' ? 'verified' : 'unverified') as 'unverified' | 'verified',
        (gstBusinessData.verification_source ?? 'manual') as 'manual' | 'cashfree' | 'secureid' | null
      )

      toast.success('Organization setup completed successfully!', { autoClose: 3000 })
      navigate('/', { replace: true })
    } catch (error: any) {
      console.error('Error updating org:', error)
      toast.error(error.message || 'Failed to update organization. Please try again.')
      setIsSubmitting(false)
    }
  }

  const validateNonGSTForm = (): boolean => {
    const errors: Partial<Record<keyof NonGSTFormData, string>> = {}

    if (!nonGSTFormData.business_name.trim()) {
      errors.business_name = 'Business name is required'
    }

    if (!validatePincode(nonGSTFormData.pincode)) {
      errors.pincode = 'Pincode must be exactly 6 digits'
    }

    if (!nonGSTFormData.state) {
      errors.state = 'State is required (auto-filled from pincode)'
    }

    setNonGSTErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNonGSTSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validateNonGSTForm() || !user?.orgId || !org) {
      return
    }

    setIsSubmitting(true)
    try {
      const slug = await generateUniqueSlug(nonGSTFormData.business_name.trim(), user.orgId)
      
      await updateOrg(user.orgId, {
        name: nonGSTFormData.business_name.trim(),
        state: nonGSTFormData.state,
        pincode: nonGSTFormData.pincode,
        gst_number: undefined,
        gst_enabled: false,
        slug,
      })

      toast.success('Organization setup completed successfully!', { autoClose: 3000 })
      navigate('/', { replace: true })
    } catch (error: any) {
      console.error('Error updating org:', error)
      toast.error(error.message || 'Failed to update organization. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Show loading while fetching org
  if (authLoading || orgLoading) {
    return (
      <div className="viewport-height flex items-center justify-center bg-bg-page">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!org || org.state !== 'Default') {
    return null
  }

  // Determine step labels based on flow
  const getStepLabels = (): string[] => {
    if (isGSTRegistered === true) {
      return ['Business Type', 'GST Details']
    } else if (isGSTRegistered === false) {
      return ['Business Type', 'Business Details']
    }
    return ['Business Type', 'Business Details']
  }

  const getCurrentStepNumber = (): number => {
    if (currentStep === 'gst_check') return 1
    if (currentStep === 'gst_input' || currentStep === 'non_gst_form') return 2
    if (currentStep === 'gst_review') return 2
    return 1
  }

  return (
    <div className="viewport-height bg-bg-page safe-top safe-bottom relative overflow-hidden">
      {/* Blurred Dashboard Background */}
      <div 
        className="absolute inset-0 bg-bg-page"
        style={{
          filter: 'blur(8px)',
          opacity: 0.5,
          pointerEvents: 'none',
        }}
      >
        <div className="p-lg">
          <div className="h-8 bg-neutral-200 rounded mb-md w-1/3 animate-pulse" />
          <div className="h-32 bg-neutral-100 rounded mb-md animate-pulse" />
          <div className="h-24 bg-neutral-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/30"
        style={{ pointerEvents: 'none' }}
      />

      {/* Bottom Sheet */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-bg-card rounded-t-xl shadow-2xl safe-bottom"
        style={{
          height: '65vh',
          maxHeight: '600px',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
          zIndex: 1000,
        }}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-lg py-md border-b border-neutral-200 flex-shrink-0">
          <h1 className="text-xl font-bold text-primary-text">Finetune</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-xs px-md py-sm rounded-md text-sm font-medium text-secondary-text hover:bg-neutral-100 hover:text-primary-text transition-colors min-h-[44px]"
            disabled={isSubmitting}
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>

        {/* Progress Indicator */}
        {(currentStep !== 'gst_check') && (
          <div className="px-lg pt-md flex-shrink-0">
            <StepIndicator
              currentStep={getCurrentStepNumber()}
              stepLabels={getStepLabels()}
            />
          </div>
        )}

        {/* Form Content - Scrollable */}
        <div 
          className="flex-1 overflow-y-auto px-lg py-md"
          style={{
            animation: currentStep !== 'gst_check' ? 'slideInUp 200ms ease-out' : undefined,
          }}
        >
          {/* LEVEL 1: GST Registration Check */}
          {currentStep === 'gst_check' && (
            <div className="space-y-lg">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-primary-text mb-sm">
                  Welcome to Finetune!
                </h2>
                <p className="text-secondary-text">
                  Let's set up your organization to get started.
                </p>
              </div>

              <div className="space-y-md">
                <label className="block text-base font-medium text-primary-text mb-md">
                  Is your business registered under GST?
                  <span className="text-error ml-xs">*</span>
                </label>
                
                <div className="space-y-md">
                  <label className="flex items-center gap-md p-md rounded-lg border-2 cursor-pointer transition-all hover:bg-neutral-50"
                    style={{
                      borderColor: isGSTRegistered === true ? 'var(--color-primary)' : 'var(--color-neutral-200)',
                      backgroundColor: isGSTRegistered === true ? 'var(--color-primary-light)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="gst_registered"
                      checked={isGSTRegistered === true}
                      onChange={() => setIsGSTRegistered(true)}
                      className="w-5 h-5 text-primary"
                    />
                    <span className="text-lg font-medium text-primary-text">Yes</span>
                  </label>

                  <label className="flex items-center gap-md p-md rounded-lg border-2 cursor-pointer transition-all hover:bg-neutral-50"
                    style={{
                      borderColor: isGSTRegistered === false ? 'var(--color-primary)' : 'var(--color-neutral-200)',
                      backgroundColor: isGSTRegistered === false ? 'var(--color-primary-light)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="gst_registered"
                      checked={isGSTRegistered === false}
                      onChange={() => setIsGSTRegistered(false)}
                      className="w-5 h-5 text-primary"
                    />
                    <span className="text-lg font-medium text-primary-text">No</span>
                  </label>
                </div>
              </div>

              <Button
                onClick={handleGSTCheckContinue}
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isGSTRegistered === null}
              >
                Continue
              </Button>
            </div>
          )}

          {/* LEVEL 1A: GST Input */}
          {currentStep === 'gst_input' && (
            <div className="space-y-md">
              <div>
                <h2 className="text-xl font-bold text-primary-text mb-sm">
                  Enter Your GSTIN
                </h2>
                <p className="text-sm text-secondary-text">
                  We'll fetch your business details automatically from the GST database.
                </p>
              </div>

              <Input
                label="GSTIN"
                value={gstin}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^A-Z0-9]/gi, '').slice(0, 15).toUpperCase()
                  setGstin(value)
                }}
                placeholder="15-character GSTIN"
                maxLength={15}
                disabled={gstLoading || isSubmitting}
                required
                autoFocus
              />

              {gstLoading && (
                <div className="flex items-center gap-sm text-sm text-secondary-text">
                  <LoadingSpinner size="sm" />
                  <span>Fetching business details...</span>
                </div>
              )}

              {gstin.length > 0 && gstin.length < 15 && (
                <p className="text-sm text-warning">
                  GSTIN must be exactly 15 characters
                </p>
              )}
            </div>
          )}

          {/* LEVEL 1A: GST Review */}
          {currentStep === 'gst_review' && gstBusinessData && (
            <div className="space-y-md">
              <div>
                <h2 className="text-xl font-bold text-primary-text mb-sm">
                  Review Your Business Details
                </h2>
                <p className="text-sm text-secondary-text">
                  Please confirm your business information.{" "}
                  {gstBusinessData.verification_source === "cashfree"
                    ? "Some details may be auto-filled from verification services."
                    : "GSTIN is format-checked only and not yet verified against government records."}
                </p>
              </div>

              {gstBusinessData.gstin_status === "unverified" &&
                gstBusinessData.verification_source === "manual" && (
                  <div className="rounded-md border border-warning bg-neutral-50 px-md py-sm text-sm text-secondary-text">
                    GSTIN not auto-verified yet; we may verify this against government records
                    later.
                  </div>
                )}

              <div className="space-y-md bg-neutral-50 rounded-lg p-md">
                <div>
                  <label className="text-sm font-medium text-secondary-text">Business Name</label>
                  <p className="text-base text-primary-text mt-xs">
                    {gstBusinessData.legal_name || "N/A"}
                  </p>
                </div>

                {gstBusinessData.trade_name && (
                  <div>
                    <label className="text-sm font-medium text-secondary-text">Trade Name</label>
                    <p className="text-base text-primary-text mt-xs">{gstBusinessData.trade_name}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-secondary-text">Address</label>
                  <p className="text-base text-primary-text mt-xs">
                    {[
                      gstBusinessData.address.building,
                      gstBusinessData.address.street,
                      gstBusinessData.address.city,
                    ].filter(Boolean).join(', ') || 'N/A'}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-secondary-text">State</label>
                  <p className="text-base text-primary-text mt-xs">
                    {gstBusinessData.address.state || "N/A"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-secondary-text">Pincode</label>
                  <p className="text-base text-primary-text mt-xs">
                    {gstBusinessData.address.pincode || "N/A"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-secondary-text">GST Status</label>
                  <p className="text-base text-primary-text mt-xs">
                    {gstBusinessData.gstin_status || "N/A"}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleGSTReviewConfirm}
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting}
                disabled={isSubmitting}
              >
                Confirm & Continue
              </Button>
            </div>
          )}

          {/* LEVEL 1B: Non-GST Form */}
          {currentStep === 'non_gst_form' && (
            <form onSubmit={handleNonGSTSubmit} className="space-y-md">
              <div>
                <h2 className="text-xl font-bold text-primary-text mb-sm">
                  Business Details
                </h2>
                <p className="text-sm text-secondary-text">
                  Enter your business information to complete setup.
                </p>
              </div>

              <Input
                label="Business Name"
                value={nonGSTFormData.business_name}
                onChange={(e) => {
                  setNonGSTFormData({ ...nonGSTFormData, business_name: e.target.value })
                  if (nonGSTErrors.business_name) {
                    setNonGSTErrors({ ...nonGSTErrors, business_name: undefined })
                  }
                }}
                error={nonGSTErrors.business_name}
                required
                disabled={isSubmitting}
                placeholder="Enter your business name"
                autoFocus
              />

              <Input
                label="Pincode"
                type="text"
                inputMode="numeric"
                value={nonGSTFormData.pincode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setNonGSTFormData({ ...nonGSTFormData, pincode: value })
                  if (nonGSTErrors.pincode) {
                    setNonGSTErrors({ ...nonGSTErrors, pincode: undefined })
                  }
                }}
                error={nonGSTErrors.pincode}
                required
                disabled={isSubmitting || pincodeLoading}
                placeholder="6-digit pincode"
                maxLength={6}
              />

              {pincodeLoading && (
                <div className="flex items-center gap-sm text-sm text-secondary-text">
                  <LoadingSpinner size="sm" />
                  <span>Fetching location details...</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-secondary-text mb-xs">
                  State <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={nonGSTFormData.state}
                  readOnly
                  className="w-full min-h-[44px] px-md py-sm border rounded-md bg-neutral-100 text-base text-primary-text cursor-not-allowed"
                  placeholder="Auto-filled from pincode"
                />
                {nonGSTErrors.state && (
                  <p className="mt-xs text-sm text-error-dark">{nonGSTErrors.state}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-text mb-xs">
                  District
                </label>
                <input
                  type="text"
                  value={nonGSTFormData.district}
                  readOnly
                  className="w-full min-h-[44px] px-md py-sm border rounded-md bg-neutral-100 text-base text-primary-text cursor-not-allowed"
                  placeholder="Auto-filled from pincode"
                />
              </div>

              <Input
                label="Address Line 1"
                value={nonGSTFormData.address_line_1}
                onChange={(e) => {
                  setNonGSTFormData({ ...nonGSTFormData, address_line_1: e.target.value })
                }}
                disabled={isSubmitting}
                placeholder="Street address (optional)"
              />

              <Input
                label="Address Line 2"
                value={nonGSTFormData.address_line_2}
                onChange={(e) => {
                  setNonGSTFormData({ ...nonGSTFormData, address_line_2: e.target.value })
                }}
                disabled={isSubmitting}
                placeholder="Apartment, suite, etc. (optional)"
              />

              <Input
                label="Contact Person"
                value={nonGSTFormData.contact_person}
                onChange={(e) => {
                  setNonGSTFormData({ ...nonGSTFormData, contact_person: e.target.value })
                }}
                disabled={isSubmitting}
                placeholder="Optional"
              />

              <Input
                label="Contact"
                type="tel"
                value={nonGSTFormData.contact}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setNonGSTFormData({ ...nonGSTFormData, contact: value })
                }}
                disabled={isSubmitting}
                placeholder="10-digit mobile number (optional)"
                maxLength={10}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting}
                disabled={isSubmitting}
              >
                Complete Setup
              </Button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
