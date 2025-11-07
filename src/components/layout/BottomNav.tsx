import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  CubeIcon as CubeIconSolid,
  ClipboardDocumentListIcon as ClipboardIconSolid,
} from '@heroicons/react/24/solid'

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
  return (
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
      </div>
    </nav>
  )
}

