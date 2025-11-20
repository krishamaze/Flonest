import { useAuth } from '../../contexts/AuthContext'
import { OrgSwitcher } from '../orgs/OrgSwitcher'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { ArrowRightOnRectangleIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { formatRole } from '../../lib/formatRole'

interface IdentityHubSheetProps {
  isOpen: boolean
  onClose: () => void
  onOpenContextSheet: () => void
}

export function IdentityHubSheet({ isOpen, onClose, onOpenContextSheet }: IdentityHubSheetProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await signOut()
      onClose()
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Account">
      <div 
        className="flex flex-col h-full pb-safe-bottom"
        style={{
          padding: 'var(--padding-identity-zone)',
          gap: 'var(--spacing-xl)'
        }}
      >
        
        {/* Identity Zone */}
        <section className="space-y-lg">
          <div className="flex items-center gap-md">
            <div 
              className="flex items-center justify-center bg-primary/10 text-primary border border-primary/20 rounded-full"
              style={{
                width: 'var(--size-avatar)',
                height: 'var(--size-avatar)',
                borderRadius: 'var(--radius-avatar)',
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-bold)'
              }}
            >
              {user?.email ? user.email.substring(0, 2).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p 
                className="text-primary-text truncate"
                style={{
                  fontSize: 'var(--font-size-identity-name)',
                  fontWeight: 'var(--font-weight-identity-name)',
                  lineHeight: 'var(--line-height-identity-text)'
                }}
              >
                {user?.email}
              </p>
              <p 
                className="text-secondary-text"
                style={{
                  fontSize: 'var(--font-size-identity-role)',
                  fontWeight: 'var(--font-weight-identity-role)',
                  lineHeight: 'var(--line-height-identity-text)'
                }}
              >
                {user?.platformAdmin ? 'Platform Administrator' : formatRole(user?.role)}
              </p>
            </div>
          </div>
          
          <Button
             variant="outline"
             className="w-full justify-start"
             onClick={() => {
               onClose()
               navigate('/settings')
             }}
          >
            <UserCircleIcon className="mr-2 h-5 w-5" />
            Profile & Settings
          </Button>

          {/* ContextSheetTrigger - Inside IdentityZone */}
          <button 
            onClick={onOpenContextSheet}
            className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg text-left"
            aria-label="Switch context"
          >
            <OrgSwitcher />
          </button>
        </section>

        {/* Context Zone - Empty Placeholder */}
        <section 
          style={{
            padding: 'var(--padding-context-zone)'
          }}
          aria-hidden="true"
        >
          {/* Intentionally empty placeholder for future context preview */}
        </section>

        {/* Danger Zone */}
        <section 
          className="mt-auto border-t border-neutral-100"
          style={{
            paddingTop: 'var(--padding-danger-zone)'
          }}
        >
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start text-error hover:bg-error/5 hover:text-error"
          >
            <ArrowRightOnRectangleIcon className="mr-2 h-5 w-5" />
            Sign Out
          </Button>
        </section>

      </div>
    </Drawer>
  )
}

