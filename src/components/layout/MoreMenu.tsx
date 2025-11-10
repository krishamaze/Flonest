import { NavLink } from 'react-router-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  ArrowPathIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'

interface MoreMenuProps {
  isOpen: boolean
  onClose: () => void
}

const baseMenuItems = [
  {
    to: '/stock-ledger',
    label: 'Stock Ledger',
    icon: ArrowPathIcon,
    description: 'View stock transactions',
  },
  {
    to: '/customers',
    label: 'Customers',
    icon: UserGroupIcon,
    description: 'Manage customers',
  },
]

export function MoreMenu({ isOpen, onClose }: MoreMenuProps) {
  const { user } = useAuth()

  if (!isOpen) return null

  // Build menu items based on user role
  const moreMenuItems = [...baseMenuItems]

  // Add reviewer link for internal users
  if (user?.isInternal) {
    moreMenuItems.push({
      to: '/reviewer',
      label: 'Reviewer',
      icon: ClipboardDocumentCheckIcon,
      description: 'Review product submissions',
    })
  }

  // Add pending products link for org owners
  if (user && !user.isInternal) {
    moreMenuItems.push({
      to: '/pending-products',
      label: 'My Submissions',
      icon: DocumentTextIcon,
      description: 'View pending product submissions',
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[101] transform transition-transform duration-300 ease-out safe-bottom ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-menu-title"
      >
        <div 
          className="mx-auto max-h-[60vh] w-full max-w-lg rounded-t-2xl bg-bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div 
              className="h-1 w-12 rounded-full bg-neutral-300 cursor-grab active:cursor-grabbing"
              onClick={onClose}
              aria-label="Close menu"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onClose()
                }
              }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 px-lg py-md">
            <h2 id="more-menu-title" className="text-xl font-semibold text-primary-text">More</h2>
            <button
              onClick={onClose}
              className="rounded-md p-sm min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-text hover:bg-neutral-100 hover:text-secondary-text transition-colors"
              aria-label="Close menu"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Menu Items */}
          <div className="max-h-[calc(60vh-120px)] overflow-y-auto px-lg py-md safe-bottom">
            <nav className="space-y-2" aria-label="More menu">
              {moreMenuItems.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-md p-md rounded-md min-h-[56px] transition-colors ${
                        isActive
                          ? 'bg-primary-light text-primary font-semibold'
                          : 'text-primary-text hover:bg-bg-hover'
                      }`
                    }
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100 flex-shrink-0">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium">{item.label}</div>
                      <div className="text-xs text-secondary-text mt-xs">{item.description}</div>
                    </div>
                  </NavLink>
                )
              })}
            </nav>
          </div>
        </div>
      </div>
    </>
  )
}

