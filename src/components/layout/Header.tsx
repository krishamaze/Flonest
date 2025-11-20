import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ArrowRightOnRectangleIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/Button'
import { NotificationBell } from '../notifications/NotificationBell'
import { useOrgSwitcher } from '../orgs/OrgSwitcher'

export function Header() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { openSwitcher, getOrgDisplayInfo } = useOrgSwitcher()
  const { label } = getOrgDisplayInfo()

  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'U'

  const isPlatformAdmin = user?.platformAdmin

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white safe-top transition-all duration-200">
      <div className="mx-auto flex h-12 items-center justify-between px-md">
        {isPlatformAdmin ? (
          <div className="flex items-center gap-sm -ml-sm px-sm py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white shadow-sm p-0.5 border border-neutral-100">
              <img
                src="/pwa-192x192.png"
                alt="FineTune logo"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="text-sm font-semibold text-primary-text leading-tight">
              Platform Admin
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={openSwitcher}
            aria-label="Switch organization"
            className="group flex items-center gap-sm -ml-sm px-sm py-1 rounded-md hover:bg-neutral-50 transition-colors cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white shadow-sm p-0.5 border border-neutral-100">
              <img
                src="/pwa-192x192.png"
                alt="FineTune logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex items-center gap-xs">
              <span className="text-sm font-semibold text-primary-text leading-tight truncate max-w-[160px]">
                {label}
              </span>
              <ChevronDownIcon className="h-3 w-3 text-muted-text group-hover:text-primary transition-colors" strokeWidth={2.5} />
            </div>
          </button>
        )}

        <div className="flex items-center gap-md">
          <NotificationBell />
          
          <div className="flex items-center gap-sm border-l border-neutral-200 pl-sm">
            <div 
              className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary select-none"
              title={user?.email || 'User'}
            >
              {userInitials}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await signOut()
                  navigate('/login', { replace: true })
                } catch (error) {
                  console.error('Error signing out:', error)
                }
              }}
              className="flex items-center justify-center h-7 w-7 p-0 rounded-full text-muted-text hover:text-error hover:bg-error/10"
              aria-label="Sign out"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

