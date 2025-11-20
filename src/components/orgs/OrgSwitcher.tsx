import { createContext, useContext, type ReactNode } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'

function formatRole(role: string | null | undefined) {
  if (!role) return 'Select or create an organization'
  const map: Record<string, string> = {
    org_owner: 'Owner',
    branch_head: 'Branch Head',
    advisor: 'Advisor',
    agent: 'Agent',
  }
  return map[role] || role
}

interface OrgSwitcherContextType {
  getOrgDisplayInfo: () => { label: string; subtitle: string }
  openSwitcher: () => void
}

const OrgSwitcherContext = createContext<OrgSwitcherContextType | null>(null)

export function useOrgSwitcher() {
  const context = useContext(OrgSwitcherContext)
  if (!context) {
    throw new Error('useOrgSwitcher must be used within OrgSwitcherProvider')
  }
  return context
}

export function OrgSwitcherProvider({ children, onOpenSwitcher }: { children: ReactNode, onOpenSwitcher: () => void }) {
  const {
    user,
    currentOrg,
    currentAgentContext,
  } = useAuth()

  const inAgentMode = user?.contextMode === 'agent' && currentAgentContext
  const triggerLabel = inAgentMode
    ? currentAgentContext?.senderOrgName ?? 'Agent portal'
    : currentOrg?.orgName ?? 'Select organization'
  const triggerSubtitle = inAgentMode ? 'Agent mode' : formatRole(currentOrg?.role)

  const getOrgDisplayInfo = () => ({
    label: triggerLabel,
    subtitle: triggerSubtitle,
  })

  return (
    <OrgSwitcherContext.Provider value={{ getOrgDisplayInfo, openSwitcher: onOpenSwitcher }}>
      {children}
    </OrgSwitcherContext.Provider>
  )
}

export function OrgSwitcher() {
  const { getOrgDisplayInfo } = useOrgSwitcher()
  const { label, subtitle } = getOrgDisplayInfo()

  return (
    <div
      className="flex items-center gap-sm rounded-lg border border-neutral-200 bg-white/60 px-sm py-xs text-left shadow-sm"
    >
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-primary-text leading-tight truncate max-w-[160px]">
          {label}
        </span>
        <span className="text-xs text-muted-text leading-tight truncate max-w-[160px]">
          {subtitle}
        </span>
      </div>
      <ChevronDownIcon className="h-4 w-4 text-muted-text flex-shrink-0" aria-hidden="true" />
    </div>
  )
}
