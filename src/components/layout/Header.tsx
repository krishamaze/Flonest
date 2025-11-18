import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/Button'
import { NotificationBell } from '../notifications/NotificationBell'
import { useOrgSwitcher } from '../orgs/OrgSwitcher'

export function Header() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { openSwitcher, getOrgDisplayInfo } = useOrgSwitcher()
  const { label, subtitle } = getOrgDisplayInfo()

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-bg-card safe-top">
      <div className="mx-auto flex h-14 items-center justify-between px-md">
        <button
          type="button"
          onClick={openSwitcher}
          aria-label="Switch organization"
          className="flex items-center gap-md hover:opacity-80 transition-opacity cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white shadow-sm p-1">
            <img
              src="/pwa-192x192.png"
              alt="FineTune logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex flex-col gap-1 text-left">
            <span className="text-sm font-semibold text-primary-text leading-tight truncate max-w-[160px]">
              {label}
            </span>
            <span className="text-xs text-muted-text leading-tight truncate max-w-[160px]">
              {subtitle}
            </span>
            {user?.email && (
              <p className="text-[11px] text-muted-text truncate max-w-[160px]">{user.email}</p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-sm">
          <NotificationBell />
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
            className="flex items-center gap-sm -mr-sm"
            aria-label="Sign out"
          >
            {/* Header icon: 16px */}
            <ArrowRightOnRectangleIcon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline text-sm">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

