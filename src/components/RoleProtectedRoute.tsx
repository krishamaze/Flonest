import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AccessDenied } from './ui/AccessDenied'
import { hasPermission, type Permission } from '../lib/permissions'
import type { UserRole, AuthUser } from '../types'

interface RoleProtectedRouteProps {
  children: ReactNode
  requiredRole?: UserRole | UserRole[]
  requiredPermission?: Permission
  fallback?: 'redirect' | 'denied' // 'redirect' goes to dashboard, 'denied' shows AccessDenied
}

/**
 * Route protection based on user role or permission
 * Centralizes access logic - prefer this over direct role checks in components
 */
export function RoleProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  fallback = 'denied',
}: RoleProtectedRouteProps) {
  const { user, loading } = useAuth()

  // Show loading while auth is loading
  if (loading) {
    return null // Loading handled by parent
  }

  // Must be authenticated
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Internal users are handled separately - they should only access /reviewer routes
  if (user.platformAdmin) {
    return <Navigate to="/reviewer" replace />
  }

  // Must have org membership
  if (!user.orgId || !user.role) {
    return <Navigate to="/login" replace />
  }

  // Check role requirement
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!roles.includes(user.role)) {
      if (fallback === 'redirect') {
        return <Navigate to="/" replace />
      }
      return (
        <AccessDenied
          requiredRole={Array.isArray(requiredRole) ? requiredRole.join(' or ') : requiredRole}
        />
      )
    }
  }

  // Check permission requirement
  if (requiredPermission) {
    if (!hasPermission(user, requiredPermission)) {
      if (fallback === 'redirect') {
        return <Navigate to="/" replace />
      }
      return <AccessDenied requiredPermission={requiredPermission} />
    }
  }

  return <>{children}</>
}

/**
 * Helper function to check if user can access a route
 */
export function canAccessRoute(
  user: AuthUser | null,
  requiredRole?: UserRole | UserRole[],
  requiredPermission?: Permission
): boolean {
  if (!user || user.platformAdmin) return false
  if (!user.role) return false

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!roles.includes(user.role)) return false
  }

  if (requiredPermission) {
    if (!hasPermission(user, requiredPermission)) return false
  }

  return true
}

