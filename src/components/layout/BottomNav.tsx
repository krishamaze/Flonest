import { useState, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  HomeIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  EllipsisHorizontalIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  CubeIcon as CubeIconSolid,
  ClipboardDocumentListIcon as ClipboardIconSolid,
  ClipboardDocumentCheckIcon as ClipboardDocumentCheckIconSolid,
  ChartBarIcon as ChartBarIconSolid,
} from '@heroicons/react/24/solid'
import { useAuth } from '../../contexts/AuthContext'
import { hasPermission, MANAGE_PRODUCTS } from '../../lib/permissions'
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

const platformAdminNavItems = [
  {
    to: '/platform-admin',
    label: 'Home',
    icon: HomeIcon,
    activeIcon: HomeIconSolid,
  },
  {
    to: '/platform-admin/queue',
    label: 'Queue',
    icon: ClipboardDocumentCheckIcon,
    activeIcon: ClipboardDocumentCheckIconSolid,
  },
  {
    to: '/platform-admin/monitor',
    label: 'Monitor',
    icon: ChartBarIcon,
    activeIcon: ChartBarIconSolid,
  },
]

export function BottomNav() {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()

  // BUGFIX: Prevent rapid concurrent navigation that causes blank screen
  const isNavigatingRef = useRef(false)
  const lastNavigationRef = useRef<number>(0)

  // Determine visible nav items based on role
  let visibleNavItems = []

  if (user?.platformAdmin) {
    visibleNavItems = platformAdminNavItems
  } else {
    // For org users, show org routes based on permissions
    visibleNavItems = navItems.filter((item) => {
      // Products page requires MANAGE_PRODUCTS permission (admin/branch_head only)
      if (item.to === '/products') {
        return hasPermission(user, MANAGE_PRODUCTS)
      }
      // Dashboard and Inventory are visible to all org users
      return true
    })
  }

  // Check if any "More" menu route is active
  // For platform admin, check admin-specific sub-routes that are in the More menu
  const platformAdminMoreRoutes = ['/platform-admin/hsn', '/platform-admin/gst-verification', '/platform-admin/blocked-invoices']
  const orgMoreRoutes = ['/stock-ledger', '/customers', '/pending-products', '/settings']

  const moreRoutes = user?.platformAdmin ? platformAdminMoreRoutes : orgMoreRoutes

  const isMoreMenuActive = moreRoutes.some(path =>
    location.pathname.startsWith(path)
  )

  /**
   * BUGFIX: Debounced navigation handler to prevent blank screen
   * Prevents multiple concurrent navigations within 300ms
   */
  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    const now = Date.now()
    const timeSinceLastNav = now - lastNavigationRef.current

    // If we're currently navigating or last navigation was < 300ms ago, prevent this click
    if (isNavigatingRef.current || timeSinceLastNav < 300) {
      e.preventDefault()
      return
    }

    // If already on this path, prevent navigation
    if (location.pathname === path) {
      e.preventDefault()
      return
    }

    // Mark as navigating
    isNavigatingRef.current = true
    lastNavigationRef.current = now

    // Reset navigation lock after transition completes (300ms)
    setTimeout(() => {
      isNavigatingRef.current = false
    }, 300)
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-bg-card shadow-sm safe-bottom"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around h-16 pb-safe min-h-[64px]">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/platform-admin' || item.to === '/'}
              onClick={(e) => handleNavigation(e, item.to)}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-1 py-sm min-h-[56px] transition-all duration-150 ${isActive
                  ? 'text-primary font-semibold bg-primary/10 rounded-lg'
                  : 'text-muted-text'
                }`
              }
              aria-label={item.label}
            >
              {({ isActive }) => {
                const Icon = item.icon

                return (
                  <>
                    {/* Navigation icons: accent color only for active state, neutral/monochrome for inactive */}
                    <Icon className={`h-7 w-7 ${isActive ? 'stroke-2 text-primary' : 'stroke-1.5 text-neutral-700'}`} aria-hidden="true" />
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
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-sm min-h-[56px] transition-all duration-150 ${isMoreMenuActive
                ? 'text-primary font-semibold bg-primary/10 rounded-lg'
                : 'text-muted-text'
              }`}
            aria-label="More options"
          >
            <EllipsisHorizontalIcon className={`h-7 w-7 ${isMoreMenuActive ? 'stroke-2 text-primary' : 'stroke-1.5 text-neutral-700'}`} aria-hidden="true" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Drawer */}
      <MoreMenu isOpen={isMoreMenuOpen} onClose={() => setIsMoreMenuOpen(false)} />
    </>
  )
}
