import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  ADMIN_DEVICE_BINDING_KEY,
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_LAST_ACTIVITY_KEY,
  ADMIN_SESSION_MAX_LIFETIME_MS,
  ADMIN_SESSION_START_KEY,
} from '../../config/security'

const ACTIVITY_EVENTS: Array<keyof DocumentEventMap> = [
  'mousemove',
  'keydown',
  'touchstart',
  'visibilitychange',
]

export function PlatformAdminSessionWatcher() {
  const { user, requiresAdminMfa } = useAuth()
  const intervalRef = useRef<number | null>(null)
  const listenersBound = useRef(false)
  const lastActivityRef = useRef<number>(Date.now())
  const sessionStartRef = useRef<number>(Date.now())
  const enforcedRef = useRef(false)

  useEffect(() => {
    const enforceSignOut = async (message: string) => {
      if (enforcedRef.current) return
      enforcedRef.current = true
      await supabase.auth.signOut()
      toast.error(message, { autoClose: 4000 })
    }

    const updateActivity = () => {
      const now = Date.now()
      lastActivityRef.current = now
      sessionStorage.setItem(ADMIN_LAST_ACTIVITY_KEY, now.toString())
    }

    if (!user?.platformAdmin || requiresAdminMfa) {
      enforcedRef.current = false
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      if (listenersBound.current) {
        ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, updateActivity))
        listenersBound.current = false
      }
      return
    }

    const bindingPayload = JSON.stringify({
      ua: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
    })
    const storedBinding = localStorage.getItem(ADMIN_DEVICE_BINDING_KEY)

    if (storedBinding && storedBinding !== bindingPayload) {
      enforceSignOut('Admin session invalidated: device binding mismatch.')
      return
    }

    localStorage.setItem(ADMIN_DEVICE_BINDING_KEY, bindingPayload)

    const now = Date.now()
    sessionStartRef.current = now
    lastActivityRef.current = now
    sessionStorage.setItem(ADMIN_SESSION_START_KEY, now.toString())
    sessionStorage.setItem(ADMIN_LAST_ACTIVITY_KEY, now.toString())

    if (!listenersBound.current) {
      ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, updateActivity, { passive: true }))
      listenersBound.current = true
    }

    intervalRef.current = window.setInterval(() => {
      const current = Date.now()
      if (current - lastActivityRef.current >= ADMIN_IDLE_TIMEOUT_MS) {
        enforceSignOut('Admin session expired due to inactivity. Re-auth with MFA.')
        return
      }

      if (current - sessionStartRef.current >= ADMIN_SESSION_MAX_LIFETIME_MS) {
        enforceSignOut('Admin session reached the maximum lifetime. Re-authentication required.')
      }
    }, 30000)

    return () => {
      enforcedRef.current = false
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (listenersBound.current) {
        ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, updateActivity))
        listenersBound.current = false
      }
    }
  }, [user?.platformAdmin, requiresAdminMfa])

  return null
}


