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
    label: 'Inventory',
    icon: ClipboardDocumentListIcon,
    activeIcon: ClipboardIconSolid,
  },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-sm safe-bottom">
      <div className="flex items-center justify-around h-14 pb-safe">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-12 transition-colors ${
                isActive ? 'text-primary-600' : 'text-gray-500'
              }`
            }
          >
            {({ isActive }) => {
              const Icon = isActive ? item.activeIcon : item.icon
              return (
                <>
                  {/* Navigation icons: 20px */}
                  <Icon className="h-5 w-5" />
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

