import { useState, useEffect, KeyboardEvent } from 'react'
import { Input } from '../ui/Input'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
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
  onSearch?: () => void
  onClear?: () => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
  searching?: boolean
}

export function IdentifierInput({
  value,
  onChange,
  onValidationChange,
  onSearch,
  onClear,
  disabled = false,
  placeholder = 'Enter Mobile No (10 digits) or GSTIN (15 chars)',
  autoFocus = false,
  searching = false,
}: IdentifierInputProps) {
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<IdentifierType>('invalid')
  const [isValid, setIsValid] = useState(false)

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

    setIsValid(isValid)
    
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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isValid && !disabled && !searching) {
      e.preventDefault()
      onSearch?.()
    }
  }

  const handleClear = () => {
    onChange('')
    onClear?.()
  }

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
      <div className="relative">
        <Input
          label="Customer Identifier"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          error={error || undefined}
          disabled={disabled || searching}
          placeholder={placeholder}
          type="text"
          required
          autoFocus={autoFocus}
          className="pr-22" // Add padding for icons (clear + search + gap)
        />
        {/* Icons container - right side, positioned inside input field */}
        <div className="absolute right-md top-[calc(1.5rem+0.25rem+11px)] flex items-center gap-xs" style={{ transform: 'translateY(-50%)' }}>
          {/* Clear icon - show when there's text */}
          {value && !searching && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-neutral-100 active:bg-neutral-200 transition-colors touch-manipulation"
              aria-label="Clear input"
              disabled={disabled}
            >
              <XMarkIcon className="h-4 w-4 text-muted-text hover:text-primary-text" />
            </button>
          )}
          {/* Search icon - always visible, clickable when valid */}
          <button
            type="button"
            onClick={() => {
              if (isValid && !disabled && !searching) {
                onSearch?.()
              }
            }}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors touch-manipulation ${
              isValid && !disabled && !searching
                ? 'bg-primary text-text-on-primary hover:bg-primary-hover active:bg-primary-dark cursor-pointer shadow-sm'
                : 'bg-neutral-100 text-muted-text cursor-not-allowed'
            }`}
            aria-label="Search customer"
            disabled={!isValid || disabled || searching}
          >
            {searching ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <MagnifyingGlassIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-1 text-xs text-error" role="alert">{error}</p>
      )}
      {!error && !value && (
        <p className="mt-1 text-xs text-secondary-text" role="status">
          {placeholder}
        </p>
      )}
      {!error && type !== 'invalid' && value && (
        <p className="mt-1 text-xs text-green-600" role="status">{getHelperText()}</p>
      )}
    </div>
  )
}

