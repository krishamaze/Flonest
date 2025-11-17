/**
 * Authentication API helpers
 */

import { supabase } from '../supabase'

/**
 * Check if current user has a password set
 * Returns true if user has encrypted_password, false for OAuth-only users
 */
let lastCheckTimestamp = 0
let lastCheckPromise: Promise<boolean> | null = null

export function checkUserHasPassword(): Promise<boolean> {
  const now = Date.now()
  if (lastCheckPromise && now - lastCheckTimestamp < 1000) {
    return lastCheckPromise
  }

  lastCheckTimestamp = now
  lastCheckPromise = (async () => {
    const { data, error } = await supabase.rpc('check_user_has_password' as any)
    if (error) {
      console.error('Error checking user password:', error)
      return false
    }
    return Boolean(data ?? false)
  })()

  lastCheckPromise.finally(() => {
    if (lastCheckPromise && lastCheckTimestamp !== now) {
      // Another caller updated the timestamp - keep promise cached
      return
    }
    lastCheckPromise = null
  })

  return lastCheckPromise
}

/**
 * Set password for current user (OAuth users)
 * @param password - New password (will be validated client-side)
 */
export async function setUserPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password,
  })
  
  if (error) {
    throw error
  }
}

