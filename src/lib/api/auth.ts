/**
 * Authentication API helpers
 */

import { supabase } from '../supabase'

/**
 * Check if current user has a password set
 * Returns true if user has encrypted_password, false for OAuth-only users
 */
export async function checkUserHasPassword(): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_user_has_password' as any)
  
  if (error) {
    console.error('Error checking user password:', error)
    // Default to false (assume no password) for safety
    return false
  }
  
  return Boolean(data ?? false)
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

