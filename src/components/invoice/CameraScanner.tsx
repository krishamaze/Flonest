import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode'
import { XMarkIcon, CameraIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface CameraScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (codes: string[]) => void
  enabledFormats?: Html5QrcodeSupportedFormats[]
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
}: CameraScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<'permission-denied' | 'system-blocked' | 'camera-in-use' | 'no-camera' | 'not-supported' | 'unknown' | null>(null)
  const [success, setSuccess] = useState(false)
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)
  const detectedCodesRef = useRef<Set<string>>(new Set())
  const processTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
    try {
      setError(null)
      setErrorType(null)
      setSuccess(false)
      detectedCodesRef.current.clear()

      // Get available cameras
      let cameras: CameraDevice[] = []
      try {
        cameras = await Html5Qrcode.getCameras()
      } catch (error) {
        // If getCameras fails, it's likely a permission issue
        const parsedError = parseCameraError(error)
        setError(parsedError.message)
        setErrorType(parsedError.type)
        setIsScanning(false)
        return
      }

      if (cameras.length === 0) {
        const parsedError = parseCameraError(new DOMException('No cameras found', 'NotFoundError'))
        setError(parsedError.message)
        setErrorType(parsedError.type)
        setIsScanning(false)
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
        onScanSuccess,
        onScanFailure
      )

      setIsScanning(true)
      setError(null)
      setErrorType(null)
    } catch (error) {
      console.error('Error initializing scanner:', error)
      const parsedError = parseCameraError(error)
      setError(parsedError.message)
      setErrorType(parsedError.type)
      setIsScanning(false)
    }
  }

  const stopScanner = async () => {
    // Clear any pending timeout
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current)
      processTimeoutRef.current = null
    }

    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
      } catch (error) {
        console.error('Error stopping scanner:', error)
      }
      scannerRef.current = null
      setIsScanning(false)
    }
  }

  const switchCamera = async (newCameraId: string) => {
    if (!isScanning || !scannerRef.current) {
      // If scanner is not running, just update index - initializeScanner will handle it
      return
    }

    try {
      await stopScanner()
      setError(null)
      setSuccess(false)
      detectedCodesRef.current.clear()

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
        onScanSuccess,
        onScanFailure
      )

      setIsScanning(true)
    } catch (error) {
      console.error('Error switching camera:', error)
      setError('Failed to switch camera')
      setIsScanning(false)
    }
  }

  const handleNextCamera = async () => {
    if (availableCameras.length <= 1) return
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length
    const nextCamera = availableCameras[nextIndex]
    if (nextCamera) {
      await switchCamera(nextCamera.id)
      setCurrentCameraIndex(nextIndex)
    }
  }

  const handleScanAgain = async () => {
    setSuccess(false)
    setError(null)
    setErrorType(null)
    detectedCodesRef.current.clear()
    
    // Stop scanner completely to allow re-initialization
    await stopScanner()
    
    // Small delay to ensure cleanup is complete
    setTimeout(() => {
      // Re-initialize scanner - this will re-trigger permission prompts
      // Both browser-level and Android system-level prompts will appear
      initializeScanner()
    }, 100)
  }

  const onScanSuccess = (decodedText: string) => {
    // Avoid duplicate scans
    if (detectedCodesRef.current.has(decodedText)) {
      return
    }

    detectedCodesRef.current.add(decodedText)

    // Clear any existing timeout
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current)
    }

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
    setError(null)

    // Process codes after a brief delay to allow multiple codes to be detected
    // Use a debounce to batch multiple rapid detections
    processTimeoutRef.current = setTimeout(() => {
      const allCodes = Array.from(detectedCodesRef.current)
      if (allCodes.length > 0) {
        onScan(allCodes)
        // Auto-close after successful scan
        setTimeout(() => {
          stopScanner()
          onClose()
        }, 500)
      }
      processTimeoutRef.current = null
    }, 500)
  }

  const onScanFailure = (error: string) => {
    // Ignore quiet failures (just no code detected yet)
    if (error.includes('No MultiFormat Readers') || error.includes('NotFoundException')) {
      return
    }

    // Show error for actual problems
    if (!error.includes('No QR code') && !error.includes('No MultiFormat')) {
      setError('Image unclear. Please try again.')
      setSuccess(false)
    }
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-md bg-black/80 backdrop-blur-sm z-10">
        <h2 className="text-lg font-semibold text-white">Scan Barcode</h2>
        <div className="flex items-center gap-sm">
          {availableCameras.length > 1 && (
            <button
              onClick={handleNextCamera}
              className="p-sm rounded-md bg-white/20 hover:bg-white/30 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Switch camera"
            >
              <CameraIcon className="h-5 w-5 text-white" />
            </button>
          )}
          <button
            onClick={() => {
              stopScanner()
              onClose()
            }}
            className="p-sm rounded-md bg-white/20 hover:bg-white/30 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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

        {/* Overlay Messages */}
        {success && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-success-light border-2 border-success rounded-lg p-lg flex flex-col items-center gap-sm z-20">
            <CheckCircleIcon className="h-12 w-12 text-success" />
            <span className="text-success-dark font-semibold">Success ✅</span>
          </div>
        )}

        {error && !success && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-error-light border-2 border-error rounded-lg p-lg flex flex-col items-center gap-sm z-20 max-w-[80%]">
            <ExclamationTriangleIcon className="h-12 w-12 text-error" />
            <span className="text-error-dark font-semibold text-center">{error}</span>
            {(errorType === 'permission-denied' || errorType === 'system-blocked' || errorType === 'camera-in-use') && (
              <button
                onClick={handleScanAgain}
                className="mt-sm px-md py-sm bg-primary text-text-on-primary rounded-md font-medium flex items-center gap-xs hover:bg-primary-hover transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Try Again
              </button>
            )}
            {errorType !== 'permission-denied' && errorType !== 'system-blocked' && errorType !== 'camera-in-use' && (
              <button
                onClick={handleScanAgain}
                className="mt-sm px-md py-sm bg-error text-white rounded-md font-medium flex items-center gap-xs hover:opacity-90 transition-opacity"
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
            {!isScanning && (
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

