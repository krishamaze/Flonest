import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function PlatformAdminLoginPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // This route now simply forwards users to the unified login page.
  // Platform admins use email+password plus MFA instead of SSO.
  useEffect(() => {
    if (user?.platformAdmin) {
      navigate('/platform-admin', { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [user, navigate])

  return (
    null
  )
}

