import { useState, useEffect } from 'react'
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

/**
 * InstallPrompt Component
 * Soft banner suggesting users install the PWA
 * Appears once per session for non-installed users
 * Supports beforeinstallprompt event (Chrome/Edge/Android)
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Check if already installed or dismissed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches
    const isDismissed = sessionStorage.getItem('pwa-install-dismissed')
    
    if (isInstalled || isDismissed) {
      return
    }

    // Listen for beforeinstallprompt event (Chrome/Edge/Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      
      // Show banner after a short delay (not immediately on load)
      setTimeout(() => {
        setShowPrompt(true)
      }, 3000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // iOS Safari detection (no beforeinstallprompt support)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone
    
    if (isIOS && !isInStandaloneMode && !isDismissed) {
      // Show iOS-specific prompt after delay
      setTimeout(() => {
        setShowPrompt(true)
      }, 3000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // iOS Safari - show instructions
      setShowPrompt(false)
      return
    }

    // Chrome/Edge/Android - trigger install prompt
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      console.log('PWA installed')
    }
    
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    sessionStorage.setItem('pwa-install-dismissed', 'true')
  }

  if (!showPrompt) return null

  // iOS Safari check
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-slide-down">
      <div className="bg-primary text-text-on-primary shadow-lg mx-3 mt-3 rounded-lg overflow-hidden">
        <div className="flex items-start gap-3 p-3">
          <div className="flex-shrink-0 mt-0.5">
            <ArrowDownTrayIcon className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold mb-1">
              Install App
            </h3>
            {isIOS ? (
              <p className="text-xs opacity-90">
                Tap <span className="inline-flex items-center px-1">⬆️</span> Share, then "Add to Home Screen"
              </p>
            ) : (
              <p className="text-xs opacity-90">
                Install for faster access and offline use
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!isIOS && (
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 bg-black/20 hover:bg-black/30 rounded-md text-xs font-medium transition-colors"
              >
                Install
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-black/20 rounded-md transition-colors"
              aria-label="Dismiss"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

