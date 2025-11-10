import { useState, useEffect } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { checkVersionSync } from '../../lib/api/version'

/**
 * UpdateNotification Component
 * Shows a small update icon when a new version is available
 * Tapping it updates the app quietly
 * 
 * Note: This component checks app versions only (frontend code changes).
 * Schema versions are tracked separately and monitored in backend logs/admin dashboards.
 * Schema version mismatches do not trigger user notifications.
 */
export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration: ServiceWorkerRegistration | undefined) {
      console.log('SW registered:', registration)
      
      // Check for updates periodically (every 1 hour)
      if (registration) {
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      }
    },
    onRegisterError(error: Error) {
      console.error('SW registration error:', error)
    },
  })

  useEffect(() => {
    if (needRefresh) {
      setShowUpdate(true)
    }
  }, [needRefresh])

  // Retry wrapper with exponential backoff
  const checkVersionWithRetry = async (maxRetries: number = 3): Promise<void> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const versionCheck = await checkVersionSync()
        if (!versionCheck.inSync) {
          console.warn('Version mismatch detected:', versionCheck.message)
          setShowUpdate(true)
        }
        return // Success, exit retry loop
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        // Check if error is retryable (network errors, timeouts, 5xx errors)
        const isRetryable = 
          errorMessage.includes('network') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('fetch') ||
          (error && typeof error === 'object' && 'status' in error && 
           typeof error.status === 'number' && error.status >= 500)

        console.error(
          `Version check failed (attempt ${attempt + 1}/${maxRetries}):`,
          error
        )

        if (!isLastAttempt && isRetryable) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000
          console.log(`Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        } else if (isLastAttempt) {
          console.warn(
            'Version check failed after all retries, will try again on next event/interval'
          )
        } else {
          // Non-retryable error (e.g., 4xx, data validation)
          console.error('Non-retryable error detected, stopping retries')
          return
        }
      }
    }
  }

  // Event-driven version checks (battery-efficient)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined

    const checkVersion = async () => {
      // Only check if app is visible and online
      if (document.visibilityState === 'visible' && navigator.onLine) {
        await checkVersionWithRetry()
      }
    }

    // Check on mount
    checkVersion()

    // Check on visibility change (user returns to app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('App visible, checking version')
        checkVersion()
      }
    }

    // Check on network reconnect
    const handleOnline = () => {
      console.log('Network reconnected, checking version')
      checkVersion()
    }

    // Register event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    // Fallback: Check every 30 minutes for long-running sessions (only when visible)
    intervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('Periodic fallback check (30 min)')
        checkVersion()
      }
    }, 30 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [])

  const handleUpdate = async () => {
    setIsUpdating(true)
    
    try {
      await updateServiceWorker(true)
      // The page will reload automatically
    } catch (error) {
      console.error('Update failed:', error)
      setIsUpdating(false)
    }
  }

  if (!showUpdate) return null

  return (
    <div className="fixed bottom-20 right-4 left-4 z-[90] flex justify-center animate-slide-up">
      <button
        onClick={handleUpdate}
        disabled={isUpdating}
        className="bg-primary text-text-on-primary rounded-lg px-4 py-3 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 max-w-md"
        aria-label="Update available"
      >
        <ArrowPathIcon className={`h-5 w-5 flex-shrink-0 ${isUpdating ? 'animate-spin' : ''}`} />
        <span className="text-sm font-medium">
          {isUpdating ? 'Updating...' : 'New version available, tap to refresh 🔄'}
        </span>
      </button>
    </div>
  )
}

