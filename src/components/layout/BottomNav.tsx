import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  HomeIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  EllipsisHorizontalIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  CubeIcon as CubeIconSolid,
  ClipboardDocumentListIcon as ClipboardIconSolid,
  EllipsisHorizontalIcon as EllipsisHorizontalIconSolid,
  ClipboardDocumentCheckIcon as ClipboardDocumentCheckIconSolid,
} from '@heroicons/react/24/solid'
import { useAuth } from '../../contexts/AuthContext'
import { MoreMenu } from './MoreMenu'

const navItems = [
  {
    to: '/',
    label: 'Dashboard',
    icon: HomeIcon,
    activeIcon: HomeIconSolid,
  },
  {
    to: '/products',
    label: 'Products',
    icon: CubeIcon,
    activeIcon: CubeIconSolid,
  },
  {
    to: '/inventory',
    label: 'Invoices',
    icon: ClipboardDocumentListIcon,
    activeIcon: ClipboardIconSolid,
  },
]

export function BottomNav() {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()

  // For internal users, show only reviewer route
  if (user?.isInternal) {
    return (
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-bg-card shadow-sm safe-bottom"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-center h-16 pb-safe min-h-[64px]">
          <NavLink
            to="/reviewer"
            end
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-xs py-sm min-h-[48px] transition-colors ${
                isActive ? 'text-primary font-semibold' : 'text-muted-text'
              }`
            }
            aria-label="Reviewer"
          >
            {({ isActive }) => {
              const Icon = isActive ? ClipboardDocumentCheckIconSolid : ClipboardDocumentCheckIcon
              return (
                <>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-xs font-medium">Reviewer</span>
                </>
              )
            }}
          </NavLink>
        </div>
      </nav>
    )
  }

  // For org users, show org routes
  // Check if any "More" menu route is active
  const isMoreMenuActive = ['/stock-ledger', '/customers', '/reviewer', '/pending-products'].some(path => 
    location.pathname.startsWith(path)
  )

  return (
    <>
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-bg-card shadow-sm safe-bottom"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around h-16 pb-safe min-h-[64px]">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-xs py-sm min-h-[48px] transition-colors ${
                  isActive ? 'text-primary font-semibold' : 'text-muted-text'
                }`
              }
              aria-label={item.label}
            >
              {({ isActive }) => {
                const Icon = isActive ? item.activeIcon : item.icon
                return (
                  <>
                    {/* Navigation icons: 20px */}
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {/* Labels: text-xs (12px) */}
                    <span className="text-xs font-medium">{item.label}</span>
                  </>
                )
              }}
            </NavLink>
          ))}
          
          {/* More Menu Button */}
          <button
            onClick={() => setIsMoreMenuOpen(true)}
            className={`flex flex-1 flex-col items-center justify-center gap-xs py-sm min-h-[48px] transition-colors ${
              isMoreMenuActive ? 'text-primary font-semibold' : 'text-muted-text'
            }`}
            aria-label="More options"
          >
            {isMoreMenuActive ? (
              <EllipsisHorizontalIconSolid className="h-5 w-5" aria-hidden="true" />
            ) : (
              <EllipsisHorizontalIcon className="h-5 w-5" aria-hidden="true" />
            )}
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Drawer */}
      <MoreMenu isOpen={isMoreMenuOpen} onClose={() => setIsMoreMenuOpen(false)} />
    </>
  )
}

