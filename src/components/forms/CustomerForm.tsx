import { useState, FormEvent, useEffect } from 'react'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { isMobileDevice } from '../../lib/deviceDetection'
import type { CustomerFormData, CustomerWithMaster } from '../../types'

interface CustomerFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CustomerFormData) => Promise<void>
  customer?: CustomerWithMaster | null
  title?: string
}

export function CustomerForm({ isOpen, onClose, onSubmit, customer, title }: CustomerFormProps) {
  const [formData, setFormData] = useState<CustomerFormData>({
    alias_name: customer?.alias_name || '',
    billing_address: customer?.billing_address || '',
    shipping_address: customer?.shipping_address || '',
    notes: customer?.notes || '',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof CustomerFormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Update form data when customer changes
  useEffect(() => {
    if (customer) {
      setFormData({
        alias_name: customer.alias_name || '',
        billing_address: customer.billing_address || '',
        shipping_address: customer.shipping_address || '',
        notes: customer.notes || '',
      })
    } else {
      setFormData({
        alias_name: '',
        billing_address: '',
        shipping_address: '',
        notes: '',
      })
    }
  }, [customer, isOpen])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    setErrors({})
    setIsSubmitting(true)

    try {
      await onSubmit(formData)
      onClose()
      // Reset form
      setFormData({
        alias_name: '',
        billing_address: '',
        shipping_address: '',
        notes: '',
      })
    } catch (error) {
      console.error('Error submitting customer form:', error)
      if (error instanceof Error) {
        setErrors({ alias_name: error.message })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const master = customer?.master_customer

  const FormContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Master Customer Info (Read-only) */}
      {master && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
          <h4 className="text-sm font-semibold text-gray-900">Master Customer Info</h4>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-gray-600">Legal Name: </span>
              <span className="font-medium text-gray-900">{master.legal_name}</span>
            </div>
            {master.mobile && (
              <div>
                <span className="text-gray-600">Mobile: </span>
                <span className="font-medium text-gray-900">{master.mobile}</span>
              </div>
            )}
            {master.gstin && (
              <div>
                <span className="text-gray-600">GSTIN: </span>
                <span className="font-medium text-gray-900">{master.gstin}</span>
              </div>
            )}
            {master.email && (
              <div>
                <span className="text-gray-600">Email: </span>
                <span className="font-medium text-gray-900">{master.email}</span>
              </div>
            )}
            {master.address && (
              <div>
                <span className="text-gray-600">Address: </span>
                <span className="text-gray-900">{master.address}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Master customer information is shared across organizations and cannot be edited here.
          </p>
        </div>
      )}

      {/* Org-Specific Fields */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">Organization-Specific Information</h3>
        
        <Input
          label="Alias Name"
          value={formData.alias_name || ''}
          onChange={(e) => setFormData({ ...formData, alias_name: e.target.value })}
          error={errors.alias_name}
          disabled={isSubmitting}
          placeholder="Org-specific nickname (optional)"
          type="text"
        />

        <Textarea
          label="Billing Address"
          value={formData.billing_address || ''}
          onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
          error={errors.billing_address}
          disabled={isSubmitting}
          rows={3}
          placeholder="Billing address for this organization"
        />

        <Textarea
          label="Shipping Address"
          value={formData.shipping_address || ''}
          onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
          error={errors.shipping_address}
          disabled={isSubmitting}
          rows={3}
          placeholder="Shipping address for this organization"
        />

        <Textarea
          label="Notes"
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          error={errors.notes}
          disabled={isSubmitting}
          rows={3}
          placeholder="Organization-specific notes about this customer"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {customer ? 'Update Customer' : 'Save Customer'}
        </Button>
      </div>
    </form>
  )

  const formTitle = title || (customer ? 'Edit Customer' : 'Add Customer')

  if (isMobileDevice()) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title={formTitle}>
        {FormContent}
      </Drawer>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={formTitle}>
      {FormContent}
    </Modal>
  )
}

