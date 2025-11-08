import { useState, useEffect } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * UpdateNotification Component
 * Shows a small update icon when a new version is available
 * Tapping it updates the app quietly
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

