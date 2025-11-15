import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { reviewMasterProduct } from '../../lib/api/master-product-review'
import type { MasterProduct } from '../../lib/api/master-products'
import { CheckCircleIcon, XCircleIcon, PencilIcon } from '@heroicons/react/24/outline'

interface ReviewActionsProps {
  product: MasterProduct
  reviewerId: string
  onReviewComplete: () => void
}

export function ReviewActions({ product, reviewerId, onReviewComplete }: ReviewActionsProps) {
  const [action, setAction] = useState<'approve' | 'reject' | 'edit_and_approve' | null>(null)
  const [note, setNote] = useState('')
  const [hsnCode, setHsnCode] = useState(product.hsn_code || '')
  const [edits, setEdits] = useState({
    name: product.name,
    category: product.category || '',
    base_unit: product.base_unit,
    base_price: product.base_price?.toString() || '',
    barcode_ean: product.barcode_ean || '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!action) return

    setError(null)

    // Validate
    if (action === 'reject' && !note.trim()) {
      setError('Rejection reason is required')
      return
    }

    if ((action === 'approve' || action === 'edit_and_approve') && !hsnCode.trim()) {
      setError('HSN code is required for approval')
      return
    }

    setSubmitting(true)
    try {
      let changes: Record<string, any> | undefined = undefined
      
      if (action === 'edit_and_approve') {
        changes = {}
        if (edits.name !== product.name) changes.name = edits.name
        if (edits.category !== product.category) changes.category = edits.category || null
        if (edits.base_unit !== product.base_unit) changes.base_unit = edits.base_unit
        if (edits.base_price && parseFloat(edits.base_price) !== product.base_price) {
          changes.base_price = parseFloat(edits.base_price)
        }
        if (edits.barcode_ean !== product.barcode_ean) {
          changes.barcode_ean = edits.barcode_ean || null
        }
        
        // Only include if there are actual changes
        if (Object.keys(changes).length === 0) {
          changes = undefined
        }
      }

      await reviewMasterProduct({
        master_product_id: product.id,
        action,
        reviewerId,
        note: note.trim() || undefined,
        hsn_code: hsnCode.trim() || undefined,
        changes,
      })

      onReviewComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review product')
    } finally {
      setSubmitting(false)
    }
  }

  if (action === null) {
    return (
      <div className="space-y-md">
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
          <Button
            onClick={() => setAction('approve')}
            className="flex items-center justify-center gap-sm"
            variant="primary"
          >
            <CheckCircleIcon className="h-5 w-5" />
            Approve
          </Button>
          <Button
            onClick={() => setAction('reject')}
            className="flex items-center justify-center gap-sm"
            variant="danger"
          >
            <XCircleIcon className="h-5 w-5" />
            Reject
          </Button>
          <Button
            onClick={() => setAction('edit_and_approve')}
            className="flex items-center justify-center gap-sm"
            variant="secondary"
          >
            <PencilIcon className="h-5 w-5" />
            Edit & Approve
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-md">
      {error && (
        <div className="p-md rounded-md bg-error-light text-error-dark text-sm">
          {error}
        </div>
      )}

      {action === 'edit_and_approve' && (
        <div className="space-y-md border border-neutral-200 rounded-md p-md">
          <h4 className="text-sm font-semibold text-primary-text">Edit Product Details</h4>
          <Input
            label="Product Name"
            value={edits.name}
            onChange={(e) => setEdits({ ...edits, name: e.target.value })}
            required
          />
          <Input
            label="Category"
            value={edits.category}
            onChange={(e) => setEdits({ ...edits, category: e.target.value })}
          />
          <Input
            label="Unit"
            value={edits.base_unit}
            onChange={(e) => setEdits({ ...edits, base_unit: e.target.value })}
            required
          />
          <Input
            label="Base Price"
            type="number"
            value={edits.base_price}
            onChange={(e) => setEdits({ ...edits, base_price: e.target.value })}
          />
          <Input
            label="Barcode/EAN"
            value={edits.barcode_ean}
            onChange={(e) => setEdits({ ...edits, barcode_ean: e.target.value })}
          />
        </div>
      )}

      {(action === 'approve' || action === 'edit_and_approve') && (
        <Input
          label="HSN Code"
          value={hsnCode}
          onChange={(e) => setHsnCode(e.target.value)}
          placeholder="Enter HSN code"
          required
        />
      )}

      <Textarea
        label={action === 'reject' ? 'Rejection Reason *' : 'Note (Optional)'}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={action === 'reject' ? 'Explain why this product was rejected...' : 'Add any notes...'}
        required={action === 'reject'}
        rows={3}
      />

      <div className="flex gap-sm">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          variant={action === 'reject' ? 'danger' : 'primary'}
          className="flex-1"
        >
          {submitting ? 'Processing...' : action === 'reject' ? 'Reject Product' : action === 'edit_and_approve' ? 'Save & Approve' : 'Approve Product'}
        </Button>
        <Button
          onClick={() => {
            setAction(null)
            setNote('')
            setError(null)
          }}
          variant="secondary"
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

