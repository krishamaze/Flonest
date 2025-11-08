import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { toast } from 'react-toastify'
import { Input } from '../ui/Input'
import { CameraIcon } from '@heroicons/react/24/outline'
import { parseMultiCodes } from '../../lib/utils/scanDetection'
import { CameraScanner } from './CameraScanner'

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
  const [showCameraScanner, setShowCameraScanner] = useState(false)
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

  const handleCameraScan = (codes: string[]) => {
    if (codes.length > 0) {
      onScan(codes)
      setShowCameraScanner(false)
    }
  }

  const canUseCamera = () => {
    return (
      'mediaDevices' in navigator &&
      'getUserMedia' in navigator.mediaDevices &&
      !disabled
    )
  }


  // Handle camera button click - let CameraScanner handle permission request
  // This avoids double stream creation which can cause camera lock issues
  const handleCameraClick = () => {
    // Check if camera is available
    if (!canUseCamera()) {
      toast.error('Camera not available on this device', {
        position: 'bottom-center',
        autoClose: 3000,
        style: {
          maxWidth: '90vw',
          fontSize: '14px',
        },
      })
      return
    }

    // Just open the modal - CameraScanner will handle permission request
    // This ensures only one stream is created and properly managed
    setShowCameraScanner(true)
  }

  return (
    <>
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
          className={`pr-[3.5rem] ${isScanning ? 'border-primary' : ''}`}
        />
        {/* Camera icon button - inside input field */}
        {canUseCamera() && (
          <button
            type="button"
            onClick={handleCameraClick}
            disabled={disabled}
            className="absolute right-md top-[calc(1.5rem+0.25rem+11px)] transform -translate-y-1/2 p-xs rounded-md bg-primary text-text-on-primary hover:bg-primary-hover active:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[32px] min-h-[32px] flex items-center justify-center touch-manipulation shadow-sm"
            aria-label="Open camera scanner"
            title="Scan with camera"
          >
            <CameraIcon className="h-4 w-4" />
          </button>
        )}
        {isScanning && (
          <div className="absolute right-[4.5rem] top-[calc(1.5rem+0.25rem+11px)] transform -translate-y-1/2 flex items-center gap-xs">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-xs text-primary">Scanning...</span>
          </div>
        )}
        <p className="mt-xs text-xs text-secondary-text">
          {canUseCamera()
            ? 'Type/paste codes or tap camera icon to scan'
            : 'Scan barcode or paste multiple codes (separated by newline/comma)'}
        </p>
      </div>

      {/* Camera Scanner Modal */}
      {showCameraScanner && (
        <CameraScanner
          isOpen={showCameraScanner}
          onClose={() => setShowCameraScanner(false)}
          onScan={handleCameraScan}
        />
      )}
    </>
  )
}

