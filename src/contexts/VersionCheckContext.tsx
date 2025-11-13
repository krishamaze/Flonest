import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface VersionCheckContextType {
  showUpdateNotification: boolean
  triggerUpdateNotification: () => void
  hideUpdateNotification: () => void
}

const VersionCheckContext = createContext<VersionCheckContextType | undefined>(undefined)

export function VersionCheckProvider({ children }: { children: ReactNode }) {
  const [showUpdateNotification, setShowUpdateNotification] = useState(false)

  const triggerUpdateNotification = useCallback(() => {
    setShowUpdateNotification(true)
  }, [])

  const hideUpdateNotification = useCallback(() => {
    setShowUpdateNotification(false)
  }, [])

  return (
    <VersionCheckContext.Provider 
      value={{ 
        showUpdateNotification, 
        triggerUpdateNotification, 
        hideUpdateNotification 
      }}
    >
      {children}
    </VersionCheckContext.Provider>
  )
}

export function useVersionCheck() {
  const context = useContext(VersionCheckContext)
  if (context === undefined) {
    throw new Error('useVersionCheck must be used within a VersionCheckProvider')
  }
  return context
}

