import { useNavigate } from 'react-router-dom'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'

interface AccessDeniedProps {
  requiredRole?: string
  requiredPermission?: string
  message?: string
}

export function AccessDenied({
  requiredRole,
  requiredPermission,
  message,
}: AccessDeniedProps) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const getMessage = () => {
    if (message) return message

    if (requiredRole) {
      return `This page requires ${requiredRole} role. Your current role: ${user?.role || 'none'}`
    }

    if (requiredPermission) {
      return `You don't have permission to access this page. Required: ${requiredPermission}`
    }

    return 'You do not have permission to access this page.'
  }

  return (
    <div className="viewport-height flex items-center justify-center p-lg">
      <div className="max-w-md w-full bg-bg-card rounded-lg border border-border-color p-xl text-center shadow-md">
        <div className="flex justify-center mb-md">
          <ExclamationTriangleIcon className="h-12 w-12 text-warning" />
        </div>
        <h2 className="text-xl font-semibold text-primary-text mb-sm">
          Access Denied
        </h2>
        <p className="text-secondary-text mb-lg">
          {getMessage()}
        </p>
        {user && (
          <div className="mb-lg p-md bg-bg-hover rounded-md text-sm">
            <p className="text-secondary-text">
              <span className="font-medium">Current Role:</span>{' '}
              {user.platformAdmin ? 'Platform Admin' : user.role || 'No role assigned'}
            </p>
            {user.orgId && (
              <p className="text-secondary-text mt-xs">
                <span className="font-medium">Organization:</span>{' '}
                {user.orgId}
              </p>
            )}
          </div>
        )}
        <button
          onClick={() => navigate(user?.platformAdmin ? '/reviewer' : '/')}
          className="w-full bg-primary text-text-on-primary font-semibold py-sm px-md rounded-md hover:bg-primary-hover transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}

