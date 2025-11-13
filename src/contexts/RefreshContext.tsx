import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface RefreshStatus {
  phase: 'checking-version' | 'version-mismatch' | 'refreshing-data' | 'complete'
  message: string
  hasUpdate: boolean
}

interface RefreshContextType {
  registerRefreshHandler: (handler: () => Promise<void>) => void
  unregisterRefreshHandler: () => void
  refresh: (onStatusChange?: (status: RefreshStatus) => void) => Promise<void>
  registerServiceWorker: (registration: ServiceWorkerRegistration | undefined) => void
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined)

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [refreshHandler, setRefreshHandler] = useState<(() => Promise<void>) | null>(null)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | undefined>()

  const registerRefreshHandler = useCallback((handler: () => Promise<void>) => {
    setRefreshHandler(() => handler)
  }, [])

  const unregisterRefreshHandler = useCallback(() => {
    setRefreshHandler(null)
  }, [])

  const registerServiceWorker = useCallback((registration: ServiceWorkerRegistration | undefined) => {
    console.log('Service Worker registered with RefreshContext:', registration)
    setSwRegistration(registration)
  }, [])

  const refresh = useCallback(async (onStatusChange?: (status: RefreshStatus) => void) => {
    // Step 1: Check for app updates using Service Worker (no version table!)
    onStatusChange?.({ 
      phase: 'checking-version', 
      message: 'Checking for updates...', 
      hasUpdate: false 
    })

    if (swRegistration) {
      try {
        // Force Service Worker to check for new bundle immediately
        console.log('Triggering Service Worker update check...')
        await swRegistration.update()
        
        // SW will set needRefresh=true if new bundle detected
        // UpdateNotification component listens to needRefresh and shows yellow button
        console.log('Service Worker update check complete')
      } catch (error) {
        console.error('Service Worker update check failed:', error)
      }
    } else {
      console.warn('Service Worker not available for update check')
    }

    // Step 2: Refresh page data (if handler exists)
    if (refreshHandler) {
      onStatusChange?.({ 
        phase: 'refreshing-data', 
        message: 'Refreshing data...', 
        hasUpdate: false 
      })
      
      try {
        await refreshHandler()
      } catch (error) {
        console.error('Data refresh failed:', error)
      }
    }

    // Step 3: Complete
    onStatusChange?.({ 
      phase: 'complete', 
      message: 'Complete', 
      hasUpdate: false 
    })
  }, [refreshHandler, swRegistration])

  return (
    <RefreshContext.Provider value={{ registerRefreshHandler, unregisterRefreshHandler, refresh, registerServiceWorker }}>
      {children}
    </RefreshContext.Provider>
  )
}

export function useRefresh() {
  const context = useContext(RefreshContext)
  if (context === undefined) {
    throw new Error('useRefresh must be used within a RefreshProvider')
  }
  return context
}

