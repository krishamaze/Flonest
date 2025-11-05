import { useAuth } from '../../contexts/AuthContext'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/Button'

export function Header() {
  const { user, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white safe-top">
      <div className="mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {/* Logo: 32px × 32px */}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 shadow-sm">
            <span className="text-lg font-bold text-white">I</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Inventory</h1>
            {user && (
              <p className="text-xs text-gray-500 truncate max-w-[150px]">{user.email}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="flex items-center gap-1.5 -mr-2"
          >
            {/* Header icon: 16px */}
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

