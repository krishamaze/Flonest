import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { checkVersionSync } from '../lib/api/version'

export interface RefreshStatus {
  phase: 'checking-version' | 'version-mismatch' | 'refreshing-data' | 'complete'
  message: string
  hasUpdate: boolean
}

interface RefreshContextType {
  registerRefreshHandler: (handler: () => Promise<void>) => void
  unregisterRefreshHandler: () => void
  refresh: (onStatusChange?: (status: RefreshStatus) => void) => Promise<void>
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined)

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [refreshHandler, setRefreshHandler] = useState<(() => Promise<void>) | null>(null)

  const registerRefreshHandler = useCallback((handler: () => Promise<void>) => {
    setRefreshHandler(() => handler)
  }, [])

  const unregisterRefreshHandler = useCallback(() => {
    setRefreshHandler(null)
  }, [])

  const refresh = useCallback(async (onStatusChange?: (status: RefreshStatus) => void) => {
    // Step 1: Check for app version updates
    onStatusChange?.({ 
      phase: 'checking-version', 
      message: 'Checking for updates...', 
      hasUpdate: false 
    })

    try {
      const versionCheck = await checkVersionSync()
      
      if (!versionCheck.inSync) {
        // Version mismatch found - notify but don't auto-reload
        console.warn('Version mismatch detected during pull-to-refresh:', versionCheck.message)
        onStatusChange?.({ 
          phase: 'version-mismatch', 
          message: 'New version available!', 
          hasUpdate: true 
        })
        
        // Dispatch custom event to show UpdateNotification button
        window.dispatchEvent(new CustomEvent('version-mismatch-detected'))
        
        // Continue to data refresh even if update available
      }
    } catch (error) {
      console.error('Version check failed during pull-to-refresh:', error)
      // Continue to data refresh even if version check fails
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
  }, [refreshHandler])

  return (
    <RefreshContext.Provider value={{ registerRefreshHandler, unregisterRefreshHandler, refresh }}>
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

