import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/Button'
import { NotificationBell } from '../notifications/NotificationBell'
import { RoleTag } from './RoleTag'
import { useIdentitySheet } from '../identity/IdentitySheet'

export function Header() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { openIdentitySheet } = useIdentitySheet()

  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'U'

  return (
    <header 
      className="sticky top-0 z-40 bg-white safe-top transition-all duration-200" 
      style={{ 
        backgroundColor: 'var(--bg-card)',
        height: 'var(--size-appbar-height)',
      }}
    >
      <div 
        className="mx-auto flex items-center justify-between px-md"
        style={{
          height: 'var(--size-appbar-height)',
        }}
      >
        {/* Logo/Title */}
        <div className="flex items-center gap-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white shadow-sm p-0.5 border border-neutral-100">
            <img
              src="/pwa-192x192.png"
              alt="FineTune logo"
              className="h-full w-full object-contain"
            />
          </div>
          <RoleTag />
          {user?.platformAdmin && (
            <span 
              className="text-sm leading-tight text-primary-text"
              style={{
                fontWeight: 'var(--font-weight-appbar-title)',
                fontSize: 'var(--font-size-appbar-title)',
              }}
            >
              Platform Admin
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right-side actions: NotificationBell → ProfileMenu */}
        <div 
          className="flex items-center"
          style={{
            gap: 'var(--gap-appbar-actions)',
          }}
        >
          <NotificationBell />
          
          <div className="flex items-center gap-sm">
            <button
              type="button"
              className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary select-none focus:outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary"
              title={user?.email || 'User'}
              onClick={openIdentitySheet}
              aria-label="Open identity switcher"
            >
              {userInitials}
            </button>

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
              className="flex items-center justify-center min-h-[44px] min-w-[44px] p-2 rounded-full text-muted-text hover:text-error hover:bg-error/10 transition-all duration-150 active:scale-[0.98]"
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

