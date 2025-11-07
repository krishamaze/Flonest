import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { Input } from '../ui/Input'
import { parseMultiCodes } from '../../lib/utils/scanDetection'

interface ScannerInputProps {
  onScan: (codes: string[]) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

/**
 * ScannerInput Component
 * Detects fast scanner input (barcode scanners typically input rapidly + Enter)
 * Supports multi-code paste (newline/comma separated)
 */
export function ScannerInput({
  onScan,
  disabled = false,
  placeholder = 'Scan barcode or paste multiple codes',
  className = '',
}: ScannerInputProps) {
  const [value, setValue] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastInputTimeRef = useRef<number>(0)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Detect scanner input: fast typing (< 100ms per char) + Enter/Tab
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const now = Date.now()
    const timeSinceLastInput = now - lastInputTimeRef.current
    const isFastInput = timeSinceLastInput < 100 && newValue.length > value.length

    setValue(newValue)
    lastInputTimeRef.current = now

    // Clear existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }

    // If fast input detected, prepare for scan
    if (isFastInput) {
      setIsScanning(true)
    }

    // Auto-trigger scan after 200ms of no input (scanner finished)
    scanTimeoutRef.current = setTimeout(() => {
      if (newValue.trim()) {
        handleScanTrigger(newValue)
      }
    }, 200)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Trigger scan on Enter or Tab (common scanner behaviors)
    if ((e.key === 'Enter' || e.key === 'Tab') && value.trim()) {
      e.preventDefault()
      handleScanTrigger(value)
    }
  }

  const handleScanTrigger = (inputValue: string) => {
    // Parse multi-code input (newline/comma separated)
    const codes = parseMultiCodes(inputValue)

    if (codes.length > 0) {
      setIsScanning(true)
      onScan(codes)
      
      // Reset input after scan
      setTimeout(() => {
        setValue('')
        setIsScanning(false)
        inputRef.current?.focus()
      }, 100)
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className={`relative ${className}`}>
      <Input
        ref={inputRef}
        label="Scanner Input"
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        type="text"
        autoFocus={!disabled}
        className={isScanning ? 'border-primary' : ''}
      />
      {isScanning && (
        <div className="absolute right-md top-[2.5rem] flex items-center gap-xs">
          <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="text-xs text-primary">Scanning...</span>
        </div>
      )}
      <p className="mt-xs text-xs text-secondary-text">
        Scan barcode or paste multiple codes (separated by newline/comma)
      </p>
    </div>
  )
}

