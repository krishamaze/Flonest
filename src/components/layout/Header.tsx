import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/Button'
import { NotificationBell } from '../notifications/NotificationBell'
import { OrgSwitcher } from '../orgs/OrgSwitcher'

export function Header() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-bg-card safe-top">
      <div className="mx-auto flex h-14 items-center justify-between px-md">
        <div className="flex items-center gap-md">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white shadow-sm p-1">
            <img
              src="/pwa-192x192.png"
              alt="finetune"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex flex-col gap-1">
            <OrgSwitcher />
            {user?.email && (
              <p className="text-[11px] text-muted-text truncate max-w-[160px]">{user.email}</p>
            )}
          </div>
        </div>

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

