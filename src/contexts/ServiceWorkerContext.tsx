import { createContext, useContext, useMemo, useState, ReactNode } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface ServiceWorkerContextType {
  registration: ServiceWorkerRegistration | undefined
  needRefresh: boolean
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
}

const ServiceWorkerContext = createContext<ServiceWorkerContextType | undefined>(undefined)

export function ServiceWorkerProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | undefined>()

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(reg) {
      console.log('[SW] Registered:', reg)
      setRegistration(reg)
    },
    onRegisterError(error) {
      console.error('[SW] Registration error:', error)
    },
  })

  const value = useMemo(
    () => ({
      registration,
      needRefresh: !!needRefresh,
      updateServiceWorker,
    }),
    [registration, needRefresh, updateServiceWorker],
  )

  return (
    <ServiceWorkerContext.Provider value={value}>
      {children}
    </ServiceWorkerContext.Provider>
  )
}

export function useServiceWorker() {
  const ctx = useContext(ServiceWorkerContext)
  if (!ctx) {
    throw new Error('useServiceWorker must be used within a ServiceWorkerProvider')
  }
  return ctx
}


