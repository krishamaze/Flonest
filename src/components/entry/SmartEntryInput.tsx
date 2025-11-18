/**
 * SmartEntryInput Component
 * 
 * Architecture: "Dumb" render-only component that delegates all business logic to useSmartEntry hook.
 * This component contains ZERO state management - it only renders based on hook state.
 * 
 * Visual States:
 * - Processing: Shows spinner when isSearching is true
 * - Locked (Success): Read-only input with green border + checkmark when product/serial found
 * - New Entry: Shows "Create Product" button when resolution is UNKNOWN
 * - Error: Shows error message when resolution fails
 * 
 * Input Hygiene:
 * - Handles Enter key to bypass debounce and trigger immediate lookup
 * - Provides unlock/reset functionality for locked states
 */

import { useRef, KeyboardEvent, forwardRef, useImperativeHandle } from 'react'
import { useSmartEntry, type EntryState } from '@/hooks/useSmartEntry'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'

export interface SmartEntryInputProps {
  orgId: string
  placeholder?: string
  className?: string
  disabled?: boolean
  onProductFound?: (data: {
    type: 'SERIAL_FOUND' | 'PRODUCT_FOUND'
    product_id: string
    product_name: string
    product_sku: string
    selling_price: number | null
    hsn_code: string | null
    gst_rate: number | null
  }) => void
  onUnknownEntry?: (query: string) => void
  onError?: (message: string) => void
  debounceMs?: number
  minQueryLength?: number
}

export interface SmartEntryInputRef {
  focus: () => void
  clear: () => void
}

export const SmartEntryInput = forwardRef<SmartEntryInputRef, SmartEntryInputProps>(({
  orgId,
  placeholder = 'Scan barcode, enter SKU, or serial number',
  className = '',
  disabled = false,
  onProductFound,
  onUnknownEntry,
  onError,
  debounceMs,
  minQueryLength,
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null)

  // Delegate all logic to hook - component is "dumb"
  const { state, query, setQuery, clear: clearHook, isSearching, reset, executeImmediate } = useSmartEntry({
    orgId,
    debounceMs,
    minQueryLength,
    onStateChange: (newState: EntryState) => {
      // Call callbacks based on state changes
      if (newState.type === 'SERIAL_FOUND' || newState.type === 'PRODUCT_FOUND') {
        onProductFound?.({
          type: newState.type,
          product_id: newState.data.product_id,
          product_name: newState.data.product_name,
          product_sku: newState.data.product_sku,
          selling_price: newState.data.selling_price,
          hsn_code: newState.data.hsn_code,
          gst_rate: newState.data.gst_rate,
        })
      } else if (newState.type === 'UNKNOWN') {
        onUnknownEntry?.(newState.query)
      } else if (newState.type === 'ERROR') {
        onError?.(newState.message)
      }
    },
  })

  // Determine if input should be locked (read-only)
  const isLocked = state.type === 'SERIAL_FOUND' || state.type === 'PRODUCT_FOUND'
  const isUnknown = state.type === 'UNKNOWN'
  const hasError = state.type === 'ERROR'

  // Handle Enter key to bypass debounce - triggers immediate lookup
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim() && !isLocked && !isSearching) {
      e.preventDefault()
      const currentQuery = query.trim()
      if (currentQuery.length >= (minQueryLength || 1)) {
        // Use immediate execution to bypass debounce
        executeImmediate(currentQuery)
      }
    }
  }

  // Handle unlock/reset
  const handleUnlock = () => {
    reset()
    // Focus input after unlock
    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
  }

  // Expose focus and clear methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus()
    },
    clear: () => {
      clearHook()
      inputRef.current?.focus()
    },
  }))

  // Determine border color based on state
  const getBorderColor = (): string => {
    if (isLocked) {
      return 'border-green-500 focus:border-green-500 focus:outline-green-500'
    }
    if (hasError) {
      return 'border-error focus:outline-error'
    }
    return 'border-neutral-300'
  }

  return (
    <div className={`relative ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLocked}
          className={`pr-20 ${getBorderColor()}`}
          error={hasError ? state.message : undefined}
        />

        {/* Right-aligned status indicators */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Processing Spinner */}
          {isSearching && !isLocked && (
            <LoadingSpinner size="sm" className="text-primary" />
          )}

          {/* Success Checkmark (Locked State) */}
          {isLocked && (
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
              <button
                type="button"
                onClick={handleUnlock}
                tabIndex={0}
                className="p-1 hover:bg-neutral-100 rounded-full transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                aria-label="Unlock and reset"
                title="Unlock and reset"
              >
                <XMarkIcon className="h-4 w-4 text-muted-text hover:text-primary-text" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Product Info Display (when locked) */}
      {isLocked && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">
                {state.data.product_name}
              </p>
              <p className="text-xs text-green-700 mt-1">
                SKU: {state.data.product_sku}
                {state.data.selling_price && (
                  <span className="ml-2">
                    • ₹{state.data.selling_price.toFixed(2)}
                  </span>
                )}
              </p>
              {state.data.hsn_code && (
                <p className="text-xs text-green-600 mt-1">
                  HSN: {state.data.hsn_code}
                  {state.data.gst_rate !== null && (
                    <span className="ml-2">• GST: {state.data.gst_rate}%</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Product Button (Unknown Entry) */}
      {isUnknown && query.trim() && (
        <div className="mt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onUnknownEntry?.(query.trim())
            }}
            className="w-full"
          >
            Create Product: "{query.trim()}"
          </Button>
        </div>
      )}
    </div>
  )
})

SmartEntryInput.displayName = 'SmartEntryInput'

