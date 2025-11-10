import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import {
  getHSNCodes,
  createHSNCode,
  updateHSNCode,
  deleteHSNCode,
  type CreateHSNCodeData,
  type UpdateHSNCodeData,
} from '../../lib/api/hsn'
import type { HSNMaster } from '../../types'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

export function HSNManager() {
  const [hsnCodes, setHsnCodes] = useState<HSNMaster[]>([])
  const [filteredCodes, setFilteredCodes] = useState<HSNMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<HSNMaster | null>(null)
  const [formData, setFormData] = useState({
    hsn_code: '',
    description: '',
    gst_rate: '',
    category: '',
    chapter_code: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadHSNCodes()
  }, [])

  useEffect(() => {
    let filtered = hsnCodes

    if (showActiveOnly) {
      filtered = filtered.filter(code => code.is_active)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(code =>
        code.hsn_code.toLowerCase().includes(query) ||
        code.description.toLowerCase().includes(query) ||
        (code.category && code.category.toLowerCase().includes(query))
      )
    }

    setFilteredCodes(filtered)
  }, [hsnCodes, searchQuery, showActiveOnly])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      // Filter is applied in useEffect above
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const loadHSNCodes = async () => {
    setLoading(true)
    try {
      const codes = await getHSNCodes({ is_active: undefined }) // Get all
      setHsnCodes(codes)
    } catch (error) {
      console.error('Error loading HSN codes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingCode(null)
    setFormData({
      hsn_code: '',
      description: '',
      gst_rate: '',
      category: '',
      chapter_code: '',
    })
    setError(null)
    setIsModalOpen(true)
  }

  const handleEdit = (code: HSNMaster) => {
    setEditingCode(code)
    setFormData({
      hsn_code: code.hsn_code,
      description: code.description,
      gst_rate: code.gst_rate.toString(),
      category: code.category || '',
      chapter_code: code.chapter_code || '',
    })
    setError(null)
    setIsModalOpen(true)
  }

  const handleDelete = async (code: HSNMaster) => {
    if (!confirm(`Are you sure you want to deactivate HSN code "${code.hsn_code}"?`)) {
      return
    }

    try {
      await deleteHSNCode(code.hsn_code)
      await loadHSNCodes()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete HSN code')
    }
  }

  const handleSubmit = async () => {
    setError(null)

    if (!formData.hsn_code.trim()) {
      setError('HSN code is required')
      return
    }

    if (!formData.description.trim()) {
      setError('Description is required')
      return
    }

    const gstRate = parseFloat(formData.gst_rate)
    if (isNaN(gstRate) || gstRate < 0 || gstRate > 28) {
      setError('GST rate must be between 0 and 28')
      return
    }

    setSubmitting(true)
    try {
      if (editingCode) {
        await updateHSNCode(editingCode.hsn_code, {
          description: formData.description,
          gst_rate: gstRate,
          category: formData.category || undefined,
          chapter_code: formData.chapter_code || undefined,
        })
      } else {
        await createHSNCode({
          hsn_code: formData.hsn_code.trim(),
          description: formData.description.trim(),
          gst_rate: gstRate,
          category: formData.category || undefined,
          chapter_code: formData.chapter_code || undefined,
        })
      }
      setIsModalOpen(false)
      await loadHSNCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save HSN code')
    } finally {
      setSubmitting(false)
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary-text">HSN Manager</h1>
          <p className="mt-xs text-sm text-secondary-text">
            Manage HSN codes and GST rates
          </p>
        </div>
        <Button onClick={handleAdd} variant="primary" className="flex items-center gap-sm">
          <PlusIcon className="h-5 w-5" />
          Add HSN Code
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-md">
        <div className="flex gap-md items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-md top-1/2 -translate-y-1/2 h-5 w-5 text-muted-text" />
            <Input
              type="text"
              placeholder="Search by HSN code, description, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-xl"
            />
          </div>
          <label className="flex items-center gap-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-secondary-text">Active only</span>
          </label>
        </div>
      </div>

      {/* HSN Codes List */}
      {filteredCodes.length === 0 ? (
        <Card>
          <CardContent className="p-xl text-center">
            <p className="text-secondary-text">
              {searchQuery ? 'No HSN codes found matching your search.' : 'No HSN codes found.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-sm">
          {filteredCodes.map((code) => (
            <Card key={code.hsn_code}>
              <CardContent className="p-md">
                <div className="flex items-start justify-between gap-md">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-sm mb-xs">
                      <h3 className="text-base font-semibold text-primary-text">
                        {code.hsn_code}
                      </h3>
                      {code.is_active ? (
                        <span className="inline-flex items-center gap-xs px-sm py-xs rounded-full bg-success-light text-success-dark text-xs font-medium">
                          <CheckCircleIcon className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-xs px-sm py-xs rounded-full bg-error-light text-error-dark text-xs font-medium">
                          <XCircleIcon className="h-3 w-3" />
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-secondary-text mb-xs">{code.description}</p>
                    <div className="flex gap-md text-xs text-muted-text">
                      <span>GST Rate: {code.gst_rate}%</span>
                      {code.category && <span>Category: {code.category}</span>}
                      {code.chapter_code && <span>Chapter: {code.chapter_code}</span>}
                    </div>
                  </div>
                  <div className="flex gap-sm flex-shrink-0">
                    <Button
                      onClick={() => handleEdit(code)}
                      variant="secondary"
                      className="p-sm"
                      aria-label="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    {code.is_active && (
                      <Button
                        onClick={() => handleDelete(code)}
                        variant="danger"
                        className="p-sm"
                        aria-label="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setError(null)
        }}
        title={editingCode ? 'Edit HSN Code' : 'Add HSN Code'}
      >
        <div className="space-y-md">
          {error && (
            <div className="p-md rounded-md bg-error-light text-error-dark text-sm">
              {error}
            </div>
          )}

          <Input
            label="HSN Code"
            value={formData.hsn_code}
            onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
            placeholder="e.g., 8471"
            required
            disabled={!!editingCode}
          />

          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Product description"
            required
          />

          <Input
            label="GST Rate (%)"
            type="number"
            value={formData.gst_rate}
            onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })}
            placeholder="0-28"
            min="0"
            max="28"
            step="0.01"
            required
          />

          <Input
            label="Category (Optional)"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="Product category"
          />

          <Input
            label="Chapter Code (Optional)"
            value={formData.chapter_code}
            onChange={(e) => setFormData({ ...formData, chapter_code: e.target.value })}
            placeholder="Chapter code"
          />

          <div className="flex gap-sm">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              variant="primary"
              className="flex-1"
            >
              {submitting ? 'Saving...' : editingCode ? 'Update' : 'Create'}
            </Button>
            <Button
              onClick={() => {
                setIsModalOpen(false)
                setError(null)
              }}
              variant="secondary"
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

