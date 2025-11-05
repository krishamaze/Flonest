import { useAuth } from '../../contexts/AuthContext'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/Button'

export function Header() {
  const { user, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white safe-top">
      <div className="container-mobile mx-auto flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-xl font-bold text-white">I</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Inventory</h1>
            {user && (
              <p className="text-xs text-gray-500">{user.email}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="flex items-center gap-2"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

