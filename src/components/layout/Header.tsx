import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/Button'
import { NotificationBell } from '../notifications/NotificationBell'
import { RoleTag } from './RoleTag'

export function Header() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'U'

  const isPlatformAdmin = user?.platformAdmin

  return (
    <header 
      className="sticky top-0 z-40 border-b border-neutral-200 bg-white safe-top transition-all duration-200" 
      style={{ 
        backgroundColor: '#ffffff',
        height: 'var(--size-appbar-height)',
      }}
    >
      <div 
        className="mx-auto flex items-center justify-between"
        style={{
          height: 'var(--size-appbar-height)',
          paddingLeft: 'var(--padding-h-appbar)',
          paddingRight: 'var(--padding-h-appbar)',
        }}
      >
        {/* Logo/Title */}
        <div className="flex items-center gap-sm -ml-sm px-sm py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white shadow-sm p-0.5 border border-neutral-100">
            <img
              src="/pwa-192x192.png"
              alt="FineTune logo"
              className="h-full w-full object-contain"
            />
          </div>
          {isPlatformAdmin && (
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

        {/* Right-side actions: RoleTag → NotificationBell → ProfileMenu */}
        <div 
          className="flex items-center"
          style={{
            gap: 'var(--gap-appbar-actions)',
          }}
        >
          <RoleTag />
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

