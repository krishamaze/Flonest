import { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'

interface AgentPortalLayoutProps {
  children: ReactNode
  title: string
}

const agentNavItems = [
  { label: 'Dashboard', path: '/agent/dashboard' },
  { label: 'DCs', path: '/agent/delivery-challans' },
  { label: 'Stock', path: '/agent/stock' },
  { label: 'Sale', path: '/agent/create-sale' },
  { label: 'Cash', path: '/agent/cash' },
]

/**
 * Agent portal wrapper used inside MainLayout content area.
 * Provides contextual banner and quick nav while reusing global chrome.
 */
export function AgentPortalLayout({ children, title }: AgentPortalLayoutProps) {
  const { switchToBusinessMode, currentAgentContext } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSwitchToBusiness = async () => {
    await switchToBusinessMode()
    navigate('/')
  }

  return (
    <section className="space-y-md">
      <div className="rounded-xl bg-secondary text-text-on-dark p-lg shadow-lg relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <div>
            <div className="flex items-center gap-sm text-sm font-medium text-primary mb-xs">
              <BuildingOfficeIcon className="h-5 w-5" aria-hidden="true" />
              <span>Agent Portal</span>
            </div>
            <h1 className="text-2xl font-bold leading-tight">{title}</h1>
            {currentAgentContext && (
              <p className="text-sm text-text-on-dark/80 mt-xs">
                Working for {currentAgentContext.senderOrgName}
              </p>
            )}
          </div>
          <button
            onClick={handleSwitchToBusiness}
            className="inline-flex items-center gap-xs rounded-full border border-white/40 px-md py-xs text-sm font-semibold text-text-on-dark transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Switch to My Business view"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            <span>My Business</span>
          </button>
        </div>

        <div className="mt-md flex flex-wrap gap-sm">
          {agentNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex-1 min-w-[120px] rounded-lg px-md py-sm text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  isActive
                    ? 'bg-primary text-text-on-primary shadow-primary'
                    : 'bg-white/15 text-text-on-dark hover:bg-white/25'
                }`}
                aria-label={`Go to ${item.label}`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-md">{children}</div>
    </section>
  )
}

