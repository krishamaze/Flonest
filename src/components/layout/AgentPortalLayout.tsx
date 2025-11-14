import { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'

interface AgentPortalLayoutProps {
  children: ReactNode
  title: string
}

/**
 * Layout wrapper for agent portal pages
 * Shows distinct header with sender org name and switch mode button
 */
export function AgentPortalLayout({ children, title }: AgentPortalLayoutProps) {
  const { user, switchToBusinessMode } = useAuth()
  const navigate = useNavigate()

  const handleSwitchToBusiness = async () => {
    await switchToBusinessMode()
    navigate('/')
  }

  return (
    <div className="viewport-height flex flex-col bg-bg-page">
      {/* Agent Portal Header - Distinct styling */}
      <header 
        className="sticky top-0 z-40 bg-secondary text-text-on-dark shadow-md"
        style={{
          background: 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-light) 100%)'
        }}
      >
        <div className="px-lg py-md">
          <div className="flex items-center justify-between mb-xs">
            <div className="flex items-center gap-sm">
              <BuildingOfficeIcon className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary">Agent Portal</span>
            </div>
            <button
              onClick={handleSwitchToBusiness}
              className="flex items-center gap-xs text-sm text-text-on-dark hover:text-primary transition-colors"
              aria-label="Switch to My Business"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span>My Business</span>
            </button>
          </div>
          <h1 className="text-xl font-bold">{title}</h1>
          {user?.agentContext && (
            <p className="text-sm text-text-on-dark opacity-80 mt-xs">
              Working for: {user.agentContext.senderOrgName}
            </p>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-lg">
        {children}
      </main>

      {/* Agent Portal Bottom Nav */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-bg-card shadow-sm safe-bottom"
        role="navigation"
        aria-label="Agent portal navigation"
      >
        <div className="flex justify-around">
          <button
            onClick={() => navigate('/agent/dashboard')}
            className="flex flex-col items-center gap-1 p-sm flex-1 text-text-secondary hover:text-primary transition-colors"
          >
            <BuildingOfficeIcon className="h-6 w-6" />
            <span className="text-xs font-medium">Dashboard</span>
          </button>
          <button
            onClick={() => navigate('/agent/delivery-challans')}
            className="flex flex-col items-center gap-1 p-sm flex-1 text-text-secondary hover:text-primary transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs font-medium">DCs</span>
          </button>
          <button
            onClick={() => navigate('/agent/stock')}
            className="flex flex-col items-center gap-1 p-sm flex-1 text-text-secondary hover:text-primary transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="text-xs font-medium">Stock</span>
          </button>
          <button
            onClick={() => navigate('/agent/create-sale')}
            className="flex flex-col items-center gap-1 p-sm flex-1 text-text-secondary hover:text-primary transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium">Sale</span>
          </button>
          <button
            onClick={() => navigate('/agent/cash')}
            className="flex flex-col items-center gap-1 p-sm flex-1 text-text-secondary hover:text-primary transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">Cash</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

