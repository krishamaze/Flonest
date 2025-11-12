import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { supabase } from '../lib/supabase'
import { updateOrg, generateUniqueSlug } from '../lib/api/orgs'
import { INDIAN_STATES } from '../lib/data/indianStates'
import { toast } from 'react-toastify'
import type { Org } from '../types'

interface SetupFormData {
  name: string
  state: string
  pincode: string
  gst_number: string
}

export function SetupPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [org, setOrg] = useState<Org | null>(null)
  const [orgLoading, setOrgLoading] = useState(true)
  const [formData, setFormData] = useState<SetupFormData>({
    name: '',
    state: '',
    pincode: '',
    gst_number: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof SetupFormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch org data and check if setup is needed
  useEffect(() => {
    if (!authLoading && user?.orgId && !user.isInternal) {
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

          // Redirect if setup already completed
          if (data.state !== 'Default') {
            navigate('/', { replace: true })
            return
          }

          setOrg(data)
          setOrgLoading(false)
        })
    } else if (!authLoading) {
      // User doesn't have org or is internal - redirect
      navigate('/')
    }
  }, [user?.orgId, user?.isInternal, authLoading, navigate])

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SetupFormData, string>> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Organization name is required'
    }

    if (!formData.state) {
      newErrors.state = 'State is required'
    }

    if (!formData.pincode.trim()) {
      newErrors.pincode = 'Pincode is required'
    } else if (!/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Pincode must be exactly 6 digits'
    }

    if (formData.gst_number.trim() && !/^[A-Z0-9]{15}$/i.test(formData.gst_number.trim())) {
      newErrors.gst_number = 'GST number must be 15 characters (alphanumeric)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validateForm() || !user?.orgId || !org) {
      return
    }

    setIsSubmitting(true)

    try {
      // Generate unique slug from organization name
      const slug = await generateUniqueSlug(formData.name.trim(), user.orgId)

      // Prepare update data
      // If GST number is provided (non-empty), use it; otherwise set to undefined (will be converted to null)
      const gstNumber = formData.gst_number.trim() || undefined
      const updateData: {
        name: string
        state: string
        pincode: string
        gst_number?: string
        gst_enabled: boolean
        slug: string
      } = {
        name: formData.name.trim(),
        state: formData.state,
        pincode: formData.pincode.trim(),
        gst_enabled: !!gstNumber,
        slug,
      }
      
      // Only include gst_number if provided (non-empty)
      if (gstNumber) {
        updateData.gst_number = gstNumber
      }

      // Update org
      await updateOrg(user.orgId, updateData)

      toast.success('Organization setup completed successfully!', { autoClose: 3000 })
      
      // Redirect to dashboard
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

  // Don't render if no org or setup not needed (redirect will happen)
  if (!org || org.state !== 'Default') {
    return null
  }

  // Prepare state options for dropdown
  const stateOptions = INDIAN_STATES.map((state) => ({
    value: state.name,
    label: state.name,
  }))

  return (
    <div className="viewport-height bg-bg-page safe-top safe-bottom">
      <div className="max-w-2xl mx-auto px-spacing-lg py-spacing-xl">
        <div className="bg-bg-card rounded-lg shadow-md p-spacing-xl">
          <div className="mb-spacing-xl">
            <h1 className="text-3xl font-bold text-primary-text mb-spacing-sm">
              Welcome to Finetune!
            </h1>
            <p className="text-secondary-text">
              Let's set up your organization to get started. This will only take a minute.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-md">
            <Input
              label="Organization Name"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                if (errors.name) setErrors({ ...errors, name: undefined })
              }}
              error={errors.name}
              required
              disabled={isSubmitting}
              placeholder="Enter your business name"
              autoFocus
            />

            <Select
              label="State"
              value={formData.state}
              onChange={(e) => {
                setFormData({ ...formData, state: e.target.value })
                if (errors.state) setErrors({ ...errors, state: undefined })
              }}
              options={stateOptions}
              error={errors.state}
              required
              disabled={isSubmitting}
            />

            <Input
              label="Pincode"
              type="text"
              inputMode="numeric"
              value={formData.pincode}
              onChange={(e) => {
                // Only allow digits, max 6
                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                setFormData({ ...formData, pincode: value })
                if (errors.pincode) setErrors({ ...errors, pincode: undefined })
              }}
              error={errors.pincode}
              required
              disabled={isSubmitting}
              placeholder="6-digit pincode"
              maxLength={6}
            />

            <Input
              label="GST Number (Optional)"
              value={formData.gst_number}
              onChange={(e) => {
                // Only allow alphanumeric, max 15, uppercase
                const value = e.target.value.replace(/[^A-Z0-9]/gi, '').slice(0, 15).toUpperCase()
                setFormData({ ...formData, gst_number: value })
                if (errors.gst_number) setErrors({ ...errors, gst_number: undefined })
              }}
              error={errors.gst_number}
              disabled={isSubmitting}
              placeholder="15-character GSTIN (if registered)"
              maxLength={15}
            />

            <div className="pt-spacing-md">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                className="w-full"
              >
                Complete Setup
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

