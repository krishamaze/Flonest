import { useState, useEffect } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useVersionCheck } from '../../contexts/VersionCheckContext'

/**
 * UpdateNotification Component
 * Uses Service Worker bundle hash detection for ALL update checks
 * No version table needed - SW automatically detects new builds
 * 
 * How it works:
 * 1. Service Worker compares bundle hashes (not version numbers)
 * 2. If new bundle detected → needRefresh = true
 * 3. Show yellow update button
 * 4. User taps → updateServiceWorker() → app reloads with new bundle
 * 
 * Triggers:
 * - Pull-to-refresh (calls registration.update())
 * - Close/reopen app (SW auto-checks)
 * - Visibility change (SW auto-checks)
 * - Network reconnect (SW auto-checks)
 * - Periodic checks (SW handles automatically)
 */
export function UpdateNotification() {
  const { showUpdateNotification, triggerUpdateNotification } = useVersionCheck()
  const [isUpdating, setIsUpdating] = useState(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration: ServiceWorkerRegistration | undefined) {
      console.log('SW registered:', registration)
      
      // Service Worker will automatically check for updates
      // We don't need manual periodic checks anymore
    },
    onRegisterError(error: Error) {
      console.error('SW registration error:', error)
    },
  })

  // Show update notification when Service Worker detects new bundle
  useEffect(() => {
    if (needRefresh) {
      console.log('Service Worker detected new bundle, showing update notification')
      triggerUpdateNotification()
    }
  }, [needRefresh, triggerUpdateNotification])

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

  if (!showUpdateNotification) return null

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

