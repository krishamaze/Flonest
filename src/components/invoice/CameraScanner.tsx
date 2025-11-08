import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode'
import { XMarkIcon, CameraIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface CameraScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan?: (codes: string[]) => void // Legacy support
  onScanSuccess?: (code: string) => void // New: doesn't auto-close (for continuous mode)
  enabledFormats?: Html5QrcodeSupportedFormats[]
  continuousMode?: boolean // New: scanner stays open after scan
}

/**
 * CameraScanner Component
 * Full-screen camera scanner for barcode/QR code detection
 * Supports multiple code detection, camera switching, and haptic feedback
 */
export function CameraScanner({
  isOpen,
  onClose,
  onScan,
  onScanSuccess,
  enabledFormats = [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.ITF,
  ],
  continuousMode = false,
}: CameraScannerProps) {
  // External state tracking to avoid Html5Qrcode's broken internal state
  type ScannerState = 'idle' | 'starting' | 'running' | 'stopping'
  const scannerStateRef = useRef<ScannerState>('idle')
  
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<'permission-denied' | 'system-blocked' | 'camera-in-use' | 'no-camera' | 'not-supported' | 'unknown' | null>(null)
  const [success, setSuccess] = useState(false)
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)
  const detectedCodesRef = useRef<Set<string>>(new Set())
  const processTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Timing tracking for error handling
  const scannerStartTimeRef = useRef<number | null>(null)
  const lastSuccessTimeRef = useRef<number | null>(null)
  const errorDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const clarityErrorToastIdRef = useRef<string | number | null>(null)
  const GRACE_PERIOD_MS = 2000 // 2 seconds grace period for camera to focus
  const ERROR_DEBOUNCE_MS = 500 // Wait 500ms of continuous errors before showing
  const SUCCESS_COOLDOWN_MS = 1000 // Don't show errors for 1s after successful scan
  
  // Scan cooldown for continuous mode (prevents duplicate scans)
  const lastScannedCodeRef = useRef<string | null>(null)
  const scanCooldownRef = useRef<NodeJS.Timeout | null>(null)
  const SCAN_COOLDOWN_MS = 2000 // 2 seconds cooldown between scans

  // Android detection utility
  const isAndroid = () => /Android/i.test(navigator.userAgent)

  // Parse camera errors to categorize them
  const parseCameraError = (error: unknown): { type: 'permission-denied' | 'system-blocked' | 'camera-in-use' | 'no-camera' | 'not-supported' | 'unknown', message: string } => {
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          return { 
            type: 'permission-denied',
            message: 'Camera permission denied. Tap "Try Again" to grant permission.'
          }
        case 'NotReadableError':
          const android = isAndroid()
          return {
            type: android ? 'system-blocked' : 'camera-in-use',
            message: android 
              ? 'Camera blocked by Android. Tap "Try Again" to grant system permission, or check Settings > Apps > [App] > Permissions > Camera'
              : 'Camera is in use by another app. Close other apps and try again.'
          }
        case 'NotFoundError':
          return { type: 'no-camera', message: 'No camera found on this device.' }
        case 'NotSupportedError':
          return { type: 'not-supported', message: 'Camera not supported in this browser.' }
        default:
          return { type: 'unknown', message: 'Failed to access camera. Please try again.' }
      }
    }
    // Check for error messages that might indicate permission issues
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase()
      if (errorMessage.includes('permission') || errorMessage.includes('not allowed')) {
        return {
          type: 'permission-denied',
          message: 'Camera permission denied. Tap "Try Again" to grant permission.'
        }
      }
      if (errorMessage.includes('not readable') || errorMessage.includes('could not start')) {
        const android = isAndroid()
        return {
          type: android ? 'system-blocked' : 'camera-in-use',
          message: android 
            ? 'Camera blocked by Android. Tap "Try Again" to grant system permission, or check Settings > Apps > [App] > Permissions > Camera'
            : 'Camera is in use by another app. Close other apps and try again.'
        }
      }
    }
    return { type: 'unknown', message: 'Failed to access camera. Please try again.' }
  }

  // Block UI interactions during scanner state transitions
  // Only block clicks within scanner container, not close button or header
  useEffect(() => {
    const disableMouseClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      // Allow close button and header buttons to work
      if (target.closest('[aria-label="Close scanner"]') || 
          target.closest('[aria-label="Switch camera"]')) {
        return
      }
      
      // Block other interactions during transitions
      if (scannerStateRef.current !== 'running' && 
          scannerStateRef.current !== 'idle' &&
          target.closest('#camera-scanner-container')) {
        event.stopPropagation()
        event.preventDefault()
      }
    }

    if (isOpen) {
      document.addEventListener('click', disableMouseClick, true)
    }

    return () => {
      document.removeEventListener('click', disableMouseClick, true)
    }
  }, [isOpen])

  // Handle browser navigation during init
  useEffect(() => {
    const disableBrowserBackButton = () => {
      if (scannerStateRef.current !== 'running' && scannerStateRef.current !== 'idle') {
        window.history.pushState(null, document.title, window.location.href)
      }
    }

    if (isOpen) {
      window.addEventListener('popstate', disableBrowserBackButton)
      // Push initial state to prevent back navigation
      window.history.pushState(null, document.title, window.location.href)
    }

    return () => {
      window.removeEventListener('popstate', disableBrowserBackButton)
    }
  }, [isOpen])

  // Initialize scanner when opened
  useEffect(() => {
    if (!isOpen) {
      // Cleanup when closed
      stopScanner()
      return
    }

    let mounted = true

    const init = async () => {
      try {
        await initializeScanner()
      } catch (error) {
        if (mounted) {
          console.error('Scanner initialization error:', error)
        }
      }
    }

    init()

    return () => {
      mounted = false
      stopScanner()
    }
  }, [isOpen])

  const initializeScanner = async () => {
    // Set state to starting
    scannerStateRef.current = 'starting'
    setError(null)
    setErrorType(null)
    setSuccess(false)
    detectedCodesRef.current.clear()
    
    // Reset timing refs
    scannerStartTimeRef.current = null
    lastSuccessTimeRef.current = null
    
    // Clear any pending error debounce
    if (errorDebounceRef.current) {
      clearTimeout(errorDebounceRef.current)
      errorDebounceRef.current = null
    }
    
    // Dismiss any existing clarity error toasts
    if (clarityErrorToastIdRef.current) {
      toast.dismiss(clarityErrorToastIdRef.current)
      clarityErrorToastIdRef.current = null
    }

    try {
      // Clear container DOM first - Html5Qrcode reuses DOM elements
      const container = document.getElementById('camera-scanner-container')
      if (container) {
        container.innerHTML = ''
      }

      // Get available cameras
      let cameras: CameraDevice[] = []
      try {
        cameras = await Html5Qrcode.getCameras()
      } catch (error) {
        // If getCameras fails, it may be a permission issue or camera problem
        const parsedError = parseCameraError(error)
        setError(parsedError.message)
        setErrorType(parsedError.type)
        scannerStateRef.current = 'idle'
        return
      }

      if (cameras.length === 0) {
        const parsedError = parseCameraError(new DOMException('No cameras found', 'NotFoundError'))
        setError(parsedError.message)
        setErrorType(parsedError.type)
        scannerStateRef.current = 'idle'
        return
      }

      setAvailableCameras(cameras)

      // Prefer back camera (usually last in list on mobile)
      let preferredCameraIndex = cameras.length - 1
      // Look for back camera explicitly
      const backCamera = cameras.findIndex(
        (cam) => cam.label?.toLowerCase().includes('back') || cam.label?.toLowerCase().includes('rear')
      )
      if (backCamera !== -1) {
        preferredCameraIndex = backCamera
      }

      const cameraId = cameras[preferredCameraIndex].id
      setCurrentCameraIndex(preferredCameraIndex)

      // Create scanner instance
      const scanner = new Html5Qrcode('camera-scanner-container', {
        verbose: false,
        formatsToSupport: enabledFormats,
      })

      scannerRef.current = scanner

      // Start scanning
      await scanner.start(
        { deviceId: { exact: cameraId } },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        handleScanSuccess,
        onScanFailure
      )

      // Only set to running after successful start
      scannerStateRef.current = 'running'
      scannerStartTimeRef.current = Date.now()
      lastSuccessTimeRef.current = null
      setError(null)
      setErrorType(null)
      
      // Clear any existing clarity error toasts
      if (clarityErrorToastIdRef.current) {
        toast.dismiss(clarityErrorToastIdRef.current)
        clarityErrorToastIdRef.current = null
      }
    } catch (error) {
      console.error('Error initializing scanner:', error)
      scannerStateRef.current = 'idle'
      const parsedError = parseCameraError(error)
      setError(parsedError.message)
      setErrorType(parsedError.type)
      // Cleanup on error
      await stopScanner()
    }
  }

  const stopScanner = async () => {
    // Don't stop if already idle
    if (scannerStateRef.current === 'idle') return

    // Set state to stopping
    scannerStateRef.current = 'stopping'

    // Clear any pending timeout
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current)
      processTimeoutRef.current = null
    }

    // Clear error debounce
    if (errorDebounceRef.current) {
      clearTimeout(errorDebounceRef.current)
      errorDebounceRef.current = null
    }

    // Dismiss any clarity error toasts
    if (clarityErrorToastIdRef.current) {
      toast.dismiss(clarityErrorToastIdRef.current)
      clarityErrorToastIdRef.current = null
    }

    // Reset timing refs
    scannerStartTimeRef.current = null
    lastSuccessTimeRef.current = null
    
    // Clear scan cooldown
    if (scanCooldownRef.current) {
      clearTimeout(scanCooldownRef.current)
      scanCooldownRef.current = null
    }
    lastScannedCodeRef.current = null

    // CRITICAL: Force stop all video tracks directly from DOM elements
    // This bypasses Html5Qrcode's broken state management and prevents
    // "getVideoTracks() of null" errors
    const container = document.getElementById('camera-scanner-container')
    if (container) {
      const videoElements = container.querySelectorAll('video')
      videoElements.forEach(video => {
        const stream = video.srcObject as MediaStream | null
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop()
            track.enabled = false
          })
          video.srcObject = null
        }
      })
      // Clear container DOM completely - Html5Qrcode reuses DOM elements
      container.innerHTML = ''
    }

    // Then try scanner cleanup (errors can be ignored since tracks are already stopped)
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
      }
    } catch (err) {
      // Ignore errors - tracks already stopped directly
      console.warn('Scanner cleanup error (ignored):', err)
    }

    scannerRef.current = null
    scannerStateRef.current = 'idle'
  }

  const switchCamera = async (newCameraId: string) => {
    if (scannerStateRef.current !== 'running' || !scannerRef.current) {
      // If scanner is not running, just update index - initializeScanner will handle it
      return
    }

    try {
      await stopScanner()
      
      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setError(null)
      setErrorType(null)
      setSuccess(false)
      detectedCodesRef.current.clear()

      // Clear container before creating new scanner
      const container = document.getElementById('camera-scanner-container')
      if (container) {
        container.innerHTML = ''
      }

      scannerStateRef.current = 'starting'

      const scanner = new Html5Qrcode('camera-scanner-container', {
        verbose: false,
        formatsToSupport: enabledFormats,
      })

      scannerRef.current = scanner

      await scanner.start(
        { deviceId: { exact: newCameraId } },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        handleScanSuccess,
        onScanFailure
      )

      scannerStateRef.current = 'running'
      scannerStartTimeRef.current = Date.now()
      lastSuccessTimeRef.current = null
      
      // Clear any existing clarity error toasts
      if (clarityErrorToastIdRef.current) {
        toast.dismiss(clarityErrorToastIdRef.current)
        clarityErrorToastIdRef.current = null
      }
    } catch (error) {
      console.error('Error switching camera:', error)
      scannerStateRef.current = 'idle'
      const parsedError = parseCameraError(error)
      setError(parsedError.message)
      setErrorType(parsedError.type)
      await stopScanner()
    }
  }

  const handleNextCamera = async () => {
    // Block interaction if scanner is not in running state
    if (scannerStateRef.current !== 'running') return
    
    if (availableCameras.length <= 1) return
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length
    const nextCamera = availableCameras[nextIndex]
    if (nextCamera) {
      await switchCamera(nextCamera.id)
      setCurrentCameraIndex(nextIndex)
    }
  }

  const handleScanAgain = async () => {
    // Block interaction if scanner is transitioning
    if (scannerStateRef.current !== 'idle' && scannerStateRef.current !== 'running') return
    
    // If permission was denied, close modal so user can tap camera icon again
    // This ensures permission request happens synchronously with user gesture
    if (errorType === 'permission-denied' || errorType === 'system-blocked') {
      await stopScanner()
      onClose()
      return
    }
    
    setSuccess(false)
    setError(null)
    setErrorType(null)
    detectedCodesRef.current.clear()
    
    // Stop scanner completely to allow re-initialization
    await stopScanner()
    
    // Wait for cleanup to complete (500ms delay)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Re-initialize scanner (for non-permission errors like camera-in-use, etc.)
    await initializeScanner()
  }

  const handleScanSuccess = (decodedText: string) => {
    // Scan cooldown: Prevent duplicate scans within 2 seconds (continuous mode)
    if (continuousMode) {
      if (lastScannedCodeRef.current === decodedText) {
        return // Ignore duplicate scan
      }
      
      lastScannedCodeRef.current = decodedText
      
      // Reset cooldown after 2 seconds
      if (scanCooldownRef.current) {
        clearTimeout(scanCooldownRef.current)
      }
      scanCooldownRef.current = setTimeout(() => {
        lastScannedCodeRef.current = null
      }, SCAN_COOLDOWN_MS)
    }

    // Avoid duplicate scans (legacy behavior)
    if (detectedCodesRef.current.has(decodedText)) {
      return
    }

    detectedCodesRef.current.add(decodedText)

    // Clear any existing timeout
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current)
    }

    // Clear any pending error debounce
    if (errorDebounceRef.current) {
      clearTimeout(errorDebounceRef.current)
      errorDebounceRef.current = null
    }

    // Dismiss any clarity error toasts immediately
    if (clarityErrorToastIdRef.current) {
      toast.dismiss(clarityErrorToastIdRef.current)
      clarityErrorToastIdRef.current = null
    }

    // Update last success time to prevent errors right after successful scan
    lastSuccessTimeRef.current = Date.now()

    // Clear any error state
    setError(null)
    setErrorType(null)

    // Haptic feedback (vibration)
    try {
      if ('vibrate' in navigator && navigator.vibrate) {
        navigator.vibrate(100)
      }
    } catch (error) {
      // Vibration not supported - silent fail
    }

    // Audio feedback (beep)
    playBeep()

    // Show success
    setSuccess(true)

    // Continuous mode: call onScanSuccess callback (doesn't auto-close)
    if (continuousMode && onScanSuccess) {
      // Clear detected codes to allow next scan
      detectedCodesRef.current.clear()
      // Call callback with single code
      onScanSuccess(decodedText)
      // Clear success state after a brief delay to allow next scan
      setTimeout(() => {
        setSuccess(false)
      }, 1000)
      // Don't close scanner - it stays open for next scan
      return
    }

    // Legacy mode: Process codes after a brief delay to allow multiple codes to be detected
    // Use a debounce to batch multiple rapid detections
    if (onScan) {
      processTimeoutRef.current = setTimeout(async () => {
        const allCodes = Array.from(detectedCodesRef.current)
        if (allCodes.length > 0) {
          onScan(allCodes)
          // Auto-close after successful scan with proper cleanup
          await stopScanner()
          // Small delay to ensure cleanup completes
          await new Promise(resolve => setTimeout(resolve, 200))
          onClose()
        }
        processTimeoutRef.current = null
      }, 500)
    }
  }

  const onScanFailure = (error: string) => {
    // Ignore quiet failures (just no code detected yet)
    if (error.includes('No MultiFormat Readers') || error.includes('NotFoundException')) {
      return
    }

    // Ignore "No QR code" errors - these are normal during scanning
    if (error.includes('No QR code') || error.includes('No MultiFormat')) {
      return
    }

    // Only process clarity errors after grace period
    const now = Date.now()
    const scannerStarted = scannerStartTimeRef.current
    const lastSuccess = lastSuccessTimeRef.current

    // Check if grace period has passed
    if (!scannerStarted || now - scannerStarted < GRACE_PERIOD_MS) {
      return
    }

    // Check if we recently had a successful scan - don't show errors right after success
    if (lastSuccess && now - lastSuccess < SUCCESS_COOLDOWN_MS) {
      return
    }

    // Clear any existing debounce timer
    if (errorDebounceRef.current) {
      clearTimeout(errorDebounceRef.current)
    }

    // Debounce error display - only show if error persists for ERROR_DEBOUNCE_MS
    errorDebounceRef.current = setTimeout(() => {
      // Double-check conditions before showing (in case state changed during debounce)
      const checkNow = Date.now()
      const checkScannerStarted = scannerStartTimeRef.current
      const checkLastSuccess = lastSuccessTimeRef.current

      if (!checkScannerStarted || checkNow - checkScannerStarted < GRACE_PERIOD_MS) {
        return
      }

      if (checkLastSuccess && checkNow - checkLastSuccess < SUCCESS_COOLDOWN_MS) {
        return
      }

      // Only show one clarity error toast at a time
      if (clarityErrorToastIdRef.current) {
        toast.dismiss(clarityErrorToastIdRef.current)
      }

      // Show subtle guide message as toast (not blocking error)
      clarityErrorToastIdRef.current = toast.warning('Image unclear - adjust focus', {
        position: 'bottom-center',
        autoClose: 2500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        style: {
          maxWidth: '90vw',
          fontSize: '14px',
        },
      })
    }, ERROR_DEBOUNCE_MS)
  }

  const playBeep = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch (error) {
      // Audio not supported or permission denied - silent fail
      console.warn('Audio feedback not available:', error)
    }
  }

  // Clear cooldown on unmount
  useEffect(() => {
    return () => {
      if (scanCooldownRef.current) {
        clearTimeout(scanCooldownRef.current)
      }
    }
  }, [])

  if (!isOpen) return null

  // Z-index: 9998 for scanner (below sheet 10000, above content)
  return (
    <div 
      className="fixed top-0 left-0 w-full h-screen h-[100dvh] bg-black flex flex-col"
      style={{ zIndex: 9998 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-md bg-black/80 backdrop-blur-sm z-10">
        <h2 className="text-lg font-semibold text-white">Scan Barcode</h2>
        <div className="flex items-center gap-sm">
          {availableCameras.length > 1 && (
            <button
              onClick={handleNextCamera}
              disabled={scannerStateRef.current !== 'running'}
              className="p-sm rounded-md bg-white/20 hover:bg-white/30 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Switch camera"
            >
              <CameraIcon className="h-5 w-5 text-white" />
            </button>
          )}
          <button
            onClick={async () => {
              await stopScanner()
              onClose()
            }}
            disabled={scannerStateRef.current === 'stopping'}
            className="p-sm rounded-md bg-white/20 hover:bg-white/30 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close scanner"
          >
            <XMarkIcon className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* Scanner Container */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        <div
          id="camera-scanner-container"
          ref={containerRef}
          className="w-full h-full"
        />

        {/* Loading overlay during transitions */}
        {(scannerStateRef.current === 'starting' || scannerStateRef.current === 'stopping') && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
            <div className="bg-black/80 rounded-lg p-lg flex flex-col items-center gap-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
              <span className="text-white text-sm">
                {scannerStateRef.current === 'starting' ? 'Starting camera...' : 'Stopping camera...'}
              </span>
            </div>
          </div>
        )}

        {/* Overlay Messages */}
        {success && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-success-light border-2 border-success rounded-lg p-lg flex flex-col items-center gap-sm z-20">
            <CheckCircleIcon className="h-12 w-12 text-success" />
            <span className="text-success-dark font-semibold">Success ✅</span>
          </div>
        )}

        {/* Only show error overlay for critical errors (permission, camera issues), not clarity issues */}
        {error && errorType && !success && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-error-light border-2 border-error rounded-lg p-lg flex flex-col items-center gap-sm z-20 max-w-[80%]">
            <ExclamationTriangleIcon className="h-12 w-12 text-error" />
            <span className="text-error-dark font-semibold text-center">{error}</span>
            {(errorType === 'permission-denied' || errorType === 'system-blocked' || errorType === 'camera-in-use') && (
              <button
                onClick={handleScanAgain}
                disabled={scannerStateRef.current !== 'idle' && scannerStateRef.current !== 'running'}
                className="mt-sm px-md py-sm bg-primary text-text-on-primary rounded-md font-medium flex items-center gap-xs hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Try Again
              </button>
            )}
            {errorType !== 'permission-denied' && errorType !== 'system-blocked' && errorType !== 'camera-in-use' && (
              <button
                onClick={handleScanAgain}
                disabled={scannerStateRef.current !== 'idle' && scannerStateRef.current !== 'running'}
                className="mt-sm px-md py-sm bg-error text-white rounded-md font-medium flex items-center gap-xs hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Try Again
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="p-md bg-black/80 backdrop-blur-sm text-center">
        {!error ? (
          <p className="text-sm text-white/80">
            Point camera at barcode. Multiple codes will be detected automatically.
          </p>
        ) : (
          <>
            <p className="text-sm text-white/80 mb-sm">
              {errorType === 'permission-denied' || errorType === 'system-blocked' 
                ? 'Tap "Scan Again" to grant camera permission.'
                : errorType === 'camera-in-use'
                ? 'Close other apps using the camera, then tap "Scan Again".'
                : 'Please resolve the issue and try again.'}
            </p>
            {scannerStateRef.current === 'idle' && (
              <button
                onClick={handleScanAgain}
                className="px-lg py-sm bg-primary text-text-on-primary rounded-md font-medium hover:bg-primary-hover transition-colors"
              >
                Scan Again
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

