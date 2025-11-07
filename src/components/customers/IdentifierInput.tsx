import { useState, useEffect } from 'react'
import { Input } from '../ui/Input'
import {
  detectIdentifierType,
  validateMobile,
  validateGSTIN,
  normalizeIdentifier,
  type IdentifierType,
} from '../../lib/utils/identifierValidation'

interface IdentifierInputProps {
  value: string
  onChange: (value: string) => void
  onValidationChange?: (isValid: boolean, type: IdentifierType) => void
  disabled?: boolean
  placeholder?: string
}

export function IdentifierInput({
  value,
  onChange,
  onValidationChange,
  disabled = false,
  placeholder = 'Enter Mobile (10-digit) or GSTIN',
}: IdentifierInputProps) {
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<IdentifierType>('invalid')

  useEffect(() => {
    if (!value.trim()) {
      setError(null)
      setType('invalid')
      onValidationChange?.(false, 'invalid')
      return
    }

    const detectedType = detectIdentifierType(value)
    setType(detectedType)

    if (detectedType === 'invalid') {
      setError('Invalid format. Enter a 10-digit mobile (starts with 6-9) or 15-character GSTIN.')
      onValidationChange?.(false, 'invalid')
      return
    }

    // Validate based on type
    let isValid = false
    if (detectedType === 'mobile') {
      isValid = validateMobile(value)
      if (!isValid) {
        setError('Mobile must be exactly 10 digits starting with 6, 7, 8, or 9.')
      }
    } else if (detectedType === 'gstin') {
      isValid = validateGSTIN(value)
      if (!isValid) {
        setError('Invalid GSTIN format. Must be 15 characters: 2 digits + 5 chars + 4 digits + 1 char + 1 char + Z + 1 char.')
      }
    }

    if (isValid) {
      setError(null)
      // Normalize the value
      try {
        const normalized = normalizeIdentifier(value, detectedType)
        if (normalized !== value) {
          onChange(normalized)
        }
      } catch (e) {
        // Normalization failed, but validation passed - keep original
      }
    } else {
      setError(isValid ? null : error || 'Invalid format')
    }

    onValidationChange?.(isValid, detectedType)
  }, [value, onValidationChange])

  const getHelperText = () => {
    if (type === 'mobile') {
      return 'Mobile number detected'
    }
    if (type === 'gstin') {
      return 'GSTIN detected'
    }
    return ''
  }

  return (
    <div>
      <Input
        label="Customer Identifier"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error || undefined}
        disabled={disabled}
        placeholder={placeholder}
        type="text"
        required
        inputMode="numeric"
      />
      {!error && type !== 'invalid' && value && (
        <p className="mt-1 text-xs text-green-600" role="status">{getHelperText()}</p>
      )}
    </div>
  )
}

