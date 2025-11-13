import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface RefreshContextType {
  registerRefreshHandler: (handler: () => Promise<void>) => void
  unregisterRefreshHandler: () => void
  refresh: () => Promise<void>
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

  const refresh = useCallback(async () => {
    if (refreshHandler) {
      await refreshHandler()
    }
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

