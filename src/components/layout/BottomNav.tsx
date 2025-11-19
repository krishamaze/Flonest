import { useState } from 'react'
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
  EllipsisHorizontalIcon as EllipsisHorizontalIconSolid,
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
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-xs py-sm min-h-[48px] transition-colors ${
                  isActive ? 'text-primary font-semibold' : 'text-muted-text'
                }`
              }
              aria-label={item.label}
            >
              {({ isActive }) => {
                // Use outline icon for both states if requested, but sticking to solid for active is standard
                // User requested "simple, stroke-based icons for all states". 
                // I will interpret this as using the Outline icon always, but maybe filling it or just coloring it?
                // Actually, the user said "simple, monochrome stroke icons... for a clean, modern aesthetic".
                // I'll use the outline icon for active state too, just colored.
                const Icon = item.icon 
                // To strictly follow "stroke-based icons for all states", we should use the outline icon even when active.
                // But standard pattern is solid for active. The user instruction "Refactor Iconography... Switch to simple, monochrome stroke icons" was for the dashboard body.
                // For Bottom Navigation: "Use simple, stroke-based icons for all states."
                // Okay, I will use the outline icon for active state as well.
                
                return (
                  <>
                    {/* Navigation icons: 20px */}
                    <Icon className={`h-6 w-6 ${isActive ? 'stroke-2' : 'stroke-1.5'}`} aria-hidden="true" />
                    {/* Labels: text-xs (12px) */}
                    <span className="text-[10px] font-medium mt-1">{item.label}</span>
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
            <EllipsisHorizontalIcon className={`h-6 w-6 ${isMoreMenuActive ? 'stroke-2' : 'stroke-1.5'}`} aria-hidden="true" />
            <span className="text-[10px] font-medium mt-1">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Drawer */}
      <MoreMenu isOpen={isMoreMenuOpen} onClose={() => setIsMoreMenuOpen(false)} />
    </>
  )
}

