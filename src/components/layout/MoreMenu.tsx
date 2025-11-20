import { NavLink } from 'react-router-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  ArrowPathIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { hasPermission, MANAGE_INVENTORY, canManageOrgSettings, canManageAgents } from '../../lib/permissions'

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
  const { user, agentRelationships, currentAgentContext } = useAuth()

  if (!isOpen) return null

  // Build menu items based on user role
  const moreMenuItems: typeof baseMenuItems = []

  // Platform admins only see their workspace entry point (no org routes)
  if (user?.platformAdmin) {
    moreMenuItems.push(
      {
        to: '/platform-admin/hsn',
        label: 'HSN Manager',
        icon: DocumentTextIcon,
        description: 'Manage HSN codes and tax rates',
      },
      {
        to: '/platform-admin/gst-verification',
        label: 'GST Verification',
        icon: ClipboardDocumentCheckIcon,
        description: 'Verify organization GSTINs',
      },
      {
        to: '/platform-admin/blocked-invoices',
        label: 'Blocked Invoices',
        icon: ExclamationTriangleIcon,
        description: 'Review invoices with validation errors',
      }
    )
  } else {
    // Org users see org routes based on permissions
    // Stock Ledger: admin and branch_head only
    if (hasPermission(user, MANAGE_INVENTORY)) {
      moreMenuItems.push({
        to: '/stock-ledger',
        label: 'Stock Ledger',
        icon: ArrowPathIcon,
        description: 'View stock transactions',
      })
    }
    
    // Customers: all org users
    moreMenuItems.push({
      to: '/customers',
      label: 'Customers',
      icon: UserGroupIcon,
      description: 'Manage customers',
    })
    
    // Add pending products link for org users
    moreMenuItems.push({
      to: '/pending-products',
      label: 'My Submissions',
      icon: DocumentTextIcon,
      description: 'View pending product submissions',
    })
    
    // Add agents link for admin users only
    if (canManageAgents(user)) {
      moreMenuItems.push({
        to: '/agents',
        label: 'Agents',
        icon: UserGroupIcon,
        description: 'Manage sales agents',
      })
      
      // Add cash oversight for admins
      moreMenuItems.push({
        to: '/agent-cash-oversight',
        label: 'Agent Cash',
        icon: ArrowPathIcon,
        description: 'Verify agent cash deposits',
      })
    }

    // Add settings link for admin users only
    if (canManageOrgSettings(user)) {
      moreMenuItems.push({
        to: '/settings',
        label: 'Settings',
        icon: Cog6ToothIcon,
        description: 'Manage organization settings',
      })
    }

    // Add context switcher if user has agent relationships
    if (agentRelationships.length > 0) {
      const isBusiness = user?.contextMode !== 'agent'
      moreMenuItems.push({
        to: isBusiness ? '/agent/dashboard' : '/',
        label: isBusiness ? 'Go to Agent Portal' : 'Back to My Business',
        icon: ArrowPathIcon,
        description: isBusiness
          ? 'Work for your client organizations'
          : `Return to ${currentAgentContext?.senderOrgName || 'dashboard'}`,
      })
    }
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
        className={`fixed top-0 bottom-0 left-0 right-0 z-[101] transform transition-transform duration-300 ease-out safe-top safe-bottom ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-menu-title"
      >
        <div 
          className="mx-auto h-full w-full max-w-lg bg-bg-card"
          style={{
            boxShadow: '0 -1px 3px 0 rgba(0, 0, 0, 0.1)',
          }}
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
          <div className="flex items-center justify-between border-b border-neutral-200 px-md py-md flex-shrink-0">
            <h2 id="more-menu-title" className="text-base font-normal text-primary-text">More</h2>
            <button
              onClick={onClose}
              className="rounded-md p-sm min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-text hover:bg-neutral-100 hover:text-secondary-text transition-colors"
              aria-label="Close menu"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Menu Items */}
          <div className="flex-1 overflow-y-auto px-md py-md min-h-0">
            <nav className="space-y-3" aria-label="More menu">
              {moreMenuItems.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-md p-md rounded-md min-h-[56px] transition-all duration-150 ${
                        isActive
                          ? 'bg-primary/5 text-primary font-semibold border-l-2 border-primary'
                          : 'text-primary-text hover:bg-neutral-50'
                      }`
                    }
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 flex-shrink-0">
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

