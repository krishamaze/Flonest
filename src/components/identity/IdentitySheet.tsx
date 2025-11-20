import { useState, createContext, useContext, type ReactNode } from 'react'
import { IdentityHubSheet } from './IdentityHubSheet'
import { ContextSheet } from './ContextSheet'

interface IdentitySheetContextType {
  openIdentitySheet: () => void
  openContextSheet: () => void
  isHubOpen: boolean
  closeHub: () => void
  isContextOpen: boolean
  closeContext: () => void
}

const IdentitySheetContext = createContext<IdentitySheetContextType | null>(null)

export function useIdentitySheet() {
  const context = useContext(IdentitySheetContext)
  if (!context) {
    throw new Error('useIdentitySheet must be used within an IdentitySheetProvider')
  }
  return context
}

export function IdentitySheets() {
  const { isHubOpen, closeHub, openContextSheet, isContextOpen, closeContext } = useIdentitySheet()
  
  return (
    <>
      <IdentityHubSheet 
        isOpen={isHubOpen} 
        onClose={closeHub} 
        onOpenContextSheet={openContextSheet}
      />
      <ContextSheet 
        isOpen={isContextOpen} 
        onClose={closeContext} 
      />
    </>
  )
}

export function IdentitySheetProvider({ children }: { children: ReactNode }) {
  const [isHubOpen, setIsHubOpen] = useState(false)
  const [isContextOpen, setIsContextOpen] = useState(false)

  const openIdentitySheet = () => setIsHubOpen(true)
  
  const openContextSheet = () => {
    setIsHubOpen(false)
    setIsContextOpen(true)
  }

  const closeHub = () => setIsHubOpen(false)
  const closeContext = () => setIsContextOpen(false)

  const value: IdentitySheetContextType = {
    openIdentitySheet,
    openContextSheet,
    isHubOpen,
    closeHub,
    isContextOpen,
    closeContext
  }

  return (
    <IdentitySheetContext.Provider value={value}>
      {children}
    </IdentitySheetContext.Provider>
  )
}

