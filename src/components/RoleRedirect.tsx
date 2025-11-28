import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Redirects users to their canonical role-based landing path.
 * Placed at "/" index route to enforce explicit role routing.
 */
export function RoleRedirect() {
  const { user, loading } = useAuth()

  // Wait for auth to load
  if (loading) {
    return null
  }

  // Platform admin handled by InternalUserRedirect, but include for completeness
  if (user?.platformAdmin) {
    return <Navigate to="/platform-admin" replace />
  }

  switch (user?.role) {
    case 'org_owner':
      return <Navigate to="/owner" replace />
    case 'branch_head':
      return <Navigate to="/branch" replace />
    case 'advisor':
      return <Navigate to="/advisor" replace />
    case 'agent':
      return <Navigate to="/agent" replace />
    default:
      return <Navigate to="/login" replace />
  }
}

