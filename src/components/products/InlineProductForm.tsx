import { useState, useEffect, useMemo } from 'react'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { getMasterCategories, type MasterCategoryWithSpecs, type CategorySpecField } from '../../lib/api/reactive-entry'
import type { ProductSearchMode } from '../../lib/utils/productSearchMode'
import { CheckIcon, XMarkIcon, CubeIcon } from '@heroicons/react/24/outline'
import { CURRENCY_SYMBOL } from '../../lib/utils/currency'

export interface InlineProductFormData {
  name: string
  sku: string
  hsn_code: string
  category_id: string
  category_name: string
  gst_rate: number
  selling_price?: number
  unit: string
  /** Dynamic specs from category schema */
  specs: Record<string, string>
}

interface InlineProductFormProps {
  /** Full prefill data with search mode detection (from ProductSearchCombobox) */
  prefillData?: {
    name: string
    searchMode: ProductSearchMode
    detectedCategory?: { name: string; hsn_code: string; gst_rate: number }
    serialNumber?: string
  }
  /** Simple initial search term (for basic use cases) */
  initialSearchTerm?: string
  onSubmit: (data: InlineProductFormData) => void
  onCancel: () => void
  isSubmitting?: boolean
}

export function InlineProductForm({
  prefillData,
  initialSearchTerm,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InlineProductFormProps) {
  const [categories, setCategories] = useState<MasterCategoryWithSpecs[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')

  // Dynamic specs values (keyed by field name)
  const [specsValues, setSpecsValues] = useState<Record<string, string>>({})

  // Normalize prefill - support both prefillData and initialSearchTerm
  const normalizedPrefill = prefillData || {
    name: initialSearchTerm || '',
    searchMode: 'name' as ProductSearchMode,
  }

  // Basic form fields
  const [name, setName] = useState(normalizedPrefill.name)
  const [sku, setSku] = useState('')
  const [sellingPrice, setSellingPrice] = useState<number | undefined>(undefined)

  // Get selected category
  const selectedCategory = useMemo(() =>
    categories.find(c => c.id === selectedCategoryId),
    [categories, selectedCategoryId]
  )

  // Get specs schema from selected category
  const specsSchema = useMemo(() =>
    selectedCategory?.specs_schema?.fields || [],
    [selectedCategory]
  )

  // Check if category has specs (for dynamic form rendering)
  const hasSpecs = specsSchema.length > 0

  // Load categories on mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getMasterCategories()
        setCategories(data)

        // Auto-select category if detected (IMEI → Mobile)
        if (normalizedPrefill.detectedCategory) {
          const match = data.find(c =>
            c.hsn_code === normalizedPrefill.detectedCategory?.hsn_code ||
            c.name.toLowerCase().includes(normalizedPrefill.detectedCategory?.name.toLowerCase() || '')
          )
          if (match) {
            setSelectedCategoryId(match.id)
          }
        }
      } catch (error) {
        console.error('Failed to load categories:', error)
      } finally {
        setLoadingCategories(false)
      }
    }
    loadCategories()
  }, [normalizedPrefill.detectedCategory])

  // Reset specs when category changes
  useEffect(() => {
    setSpecsValues({})
  }, [selectedCategoryId])

  // Auto-generate product name from specs (brand + model_name + other specs)
  const generatedName = useMemo(() => {
    if (!hasSpecs) return name
    const orderedFields = [...specsSchema].sort((a, b) => (a.order || 0) - (b.order || 0))
    const parts = orderedFields
      .map(field => specsValues[field.name])
      .filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : name
  }, [hasSpecs, specsSchema, specsValues, name])

  // Auto-generate SKU from brand + model
  const generatedSku = useMemo(() => {
    if (!hasSpecs || sku) return sku
    const brand = specsValues['brand'] || ''
    const modelNumber = specsValues['model_number'] || specsValues['model_name']?.replace(/\s+/g, '').substring(0, 8) || ''
    if (brand && modelNumber) {
      return `${brand.substring(0, 3).toUpperCase()}-${modelNumber.toUpperCase()}`
    }
    return sku
  }, [hasSpecs, specsValues, sku])

  // Update spec value
  const handleSpecChange = (fieldName: string, value: string) => {
    setSpecsValues(prev => ({ ...prev, [fieldName]: value }))
  }

  // Handle category selection (bidirectional with HSN)
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId)
  }

  // Handle HSN selection (bidirectional with Category)
  const handleHsnSelect = (hsnCode: string) => {
    const category = categories.find(c => c.hsn_code === hsnCode)
    if (category) {
      setSelectedCategoryId(category.id)
    }
  }

  // Validate required fields
  const isValid = useMemo(() => {
    // Must have name and sku
    const finalName = generatedName || name
    const finalSku = generatedSku || sku
    if (!finalName || !finalSku) return false

    // Must have category selected
    if (!selectedCategoryId) return false

    // Check required specs
    for (const field of specsSchema) {
      if (field.required && !specsValues[field.name]) return false
    }

    return true
  }, [generatedName, name, generatedSku, sku, selectedCategoryId, specsSchema, specsValues])

  const handleSubmit = () => {
    if (!selectedCategory) return

    const submitData: InlineProductFormData = {
      name: generatedName || name,
      sku: generatedSku || sku,
      hsn_code: selectedCategory.hsn_code,
      category_id: selectedCategory.id,
      category_name: selectedCategory.name,
      gst_rate: selectedCategory.gst_rate,
      selling_price: sellingPrice,
      unit: 'pcs',
      specs: specsValues,
    }
    onSubmit(submitData)
  }

  // Category dropdown options
  const categoryOptions = [
    { value: '', label: 'Select category...' },
    ...categories.map(c => ({ value: c.id, label: `${c.name} (${c.hsn_code})` }))
  ]

  // HSN dropdown options
  const hsnOptions = [
    { value: '', label: 'Select HSN...' },
    ...categories.map(c => ({ value: c.hsn_code, label: `${c.hsn_code} - ${c.name}` }))
  ]

  /** Render a dynamic spec field based on its schema */
  const renderSpecField = (field: CategorySpecField, index: number) => {
    const value = specsValues[field.name] || ''
    const label = field.required ? `${field.label} *` : field.label

    if (field.type === 'select' && field.options) {
      return (
        <Select
          key={field.name}
          label={label}
          value={value}
          onChange={(e) => handleSpecChange(field.name, e.target.value)}
          options={[
            { value: '', label: 'Select...' },
            ...field.options.map(opt => ({ value: opt, label: opt }))
          ]}
          disabled={isSubmitting}
          autoFocus={index === 0}
        />
      )
    }

    if (field.type === 'number') {
      return (
        <Input
          key={field.name}
          label={label}
          type="number"
          value={value}
          onChange={(e) => handleSpecChange(field.name, e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          disabled={isSubmitting}
          autoFocus={index === 0}
        />
      )
    }

    // Default: text input
    return (
      <Input
        key={field.name}
        label={label}
        value={value}
        onChange={(e) => handleSpecChange(field.name, e.target.value)}
        placeholder={`Enter ${field.label.toLowerCase()}`}
        disabled={isSubmitting}
        autoFocus={index === 0}
      />
    )
  }

  return (
    <div className="border border-primary rounded-lg p-md bg-primary-light/20 space-y-md">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CubeIcon className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-primary-text">
            {selectedCategory ? `New ${selectedCategory.name}` : 'New Product'}
          </h4>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 hover:bg-neutral-200 rounded"
          disabled={isSubmitting}
        >
          <XMarkIcon className="h-5 w-5 text-secondary-text" />
        </button>
      </div>

      {/* IMEI indicator */}
      {normalizedPrefill.serialNumber && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
          <CheckIcon className="h-4 w-4" />
          <span>IMEI: {normalizedPrefill.serialNumber}</span>
        </div>
      )}

      {/* Category & HSN (bidirectional) */}
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Category *"
          value={selectedCategoryId}
          onChange={(e) => handleCategorySelect(e.target.value)}
          options={categoryOptions}
          disabled={loadingCategories || isSubmitting}
        />
        <Select
          label="HSN Code"
          value={selectedCategory?.hsn_code || ''}
          onChange={(e) => handleHsnSelect(e.target.value)}
          options={hsnOptions}
          disabled={loadingCategories || isSubmitting}
        />
      </div>

      {/* GST Rate (auto-filled) */}
      {selectedCategory && (
        <div className="text-sm text-secondary-text">
          GST Rate: <span className="font-medium text-primary-text">{selectedCategory.gst_rate}%</span>
        </div>
      )}

      {/* Dynamic spec fields from category schema */}
      {hasSpecs ? (
        <div className="space-y-3">
          {specsSchema
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((field, index) => renderSpecField(field, index))}
        </div>
      ) : (
        /* Fallback: basic name/SKU fields for categories without specs */
        <>
          <Input
            label="Product Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter product name"
            disabled={isSubmitting}
            autoFocus
          />
          <Input
            label="SKU *"
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            placeholder="Enter SKU code"
            disabled={isSubmitting}
          />
        </>
      )}

      {/* Price */}
      <Input
        label="Selling Price"
        type="number"
        min="0"
        step="0.01"
        value={sellingPrice?.toString() || ''}
        onChange={(e) => setSellingPrice(parseFloat(e.target.value) || undefined)}
        placeholder={`${CURRENCY_SYMBOL}0.00`}
        disabled={isSubmitting}
      />

      {/* Generated name preview (for categories with specs) */}
      {hasSpecs && generatedName && generatedName !== name && (
        <div className="text-sm bg-neutral-50 p-2 rounded">
          <span className="text-secondary-text">Product Name: </span>
          <span className="font-medium text-primary-text">{generatedName}</span>
        </div>
      )}

      {/* Generated SKU preview */}
      {hasSpecs && generatedSku && generatedSku !== sku && (
        <div className="text-sm bg-neutral-50 p-2 rounded">
          <span className="text-secondary-text">SKU: </span>
          <span className="font-medium text-primary-text font-mono">{generatedSku}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          className="flex-1"
        >
          <CheckIcon className="h-4 w-4 mr-1" />
          {isSubmitting ? 'Creating...' : 'Add Product'}
        </Button>
      </div>
    </div>
  )
}
