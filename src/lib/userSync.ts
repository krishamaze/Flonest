import { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Database } from '../types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Org = Database['public']['Tables']['orgs']['Row']
type Membership = Database['public']['Tables']['memberships']['Row']
type ProfileInsert = Database['public']['Tables']['profiles']['Insert']

export interface UserProfileWithOrg {
  profile: Profile
  membership: Membership
  org: Org
}

/**
 * Sync authenticated user to profiles table
 * Creates profile if it doesn't exist, but does NOT auto-create orgs
 * Users must be invited to an org or join via org code
 *
 * @param authUser - The authenticated user from Supabase Auth
 * @returns The user profile with org and membership if user has membership, or null if no membership exists
 */
export async function syncUserProfile(authUser: User): Promise<UserProfileWithOrg | null> {
  try {
    // Check if profile already exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileError) {
      console.error('Error checking existing profile:', profileError)
      throw profileError
    }

    let profile: Profile

    // Create profile if it doesn't exist
    if (!existingProfile) {
      const profileData: ProfileInsert = {
        id: authUser.id,
        email: authUser.email || '',
        full_name: authUser.user_metadata?.full_name || null,
        avatar_url: authUser.user_metadata?.avatar_url || null,
        is_internal: false, // Default to false for new users
      }

      const { data: newProfile, error: createProfileError } = await supabase
        .from('profiles')
        .insert([profileData])
        .select()
        .single()

      if (createProfileError || !newProfile) {
        console.error('Error creating profile:', createProfileError)
        throw createProfileError
      }

      profile = newProfile
      console.log('Created new profile:', profile)
    } else {
      profile = existingProfile
      console.log('Profile already exists:', profile)
    }

    // Check if user has any memberships
    const { data: existingMembership, error: membershipError } = await supabase
      .from('memberships')
      .select('*, orgs(*)')
      .eq('profile_id', authUser.id)
      .maybeSingle()

    if (membershipError) {
      console.error('Error checking existing membership:', membershipError)
      throw membershipError
    }

    // If membership exists, return it
    if (existingMembership) {
      return {
        profile,
        membership: existingMembership,
        org: existingMembership.orgs as Org,
      }
    }

    // No membership exists - user must be invited or join an org
    // Auto-org creation is disabled in production
    console.log('No membership found - user must be invited to an org or join via org code')
    return null
  } catch (error) {
    console.error('Error syncing user profile:', error)
    return null
  }
}

/**
 * Get user profile with org and membership
 *
 * @param userId - The user ID from Supabase Auth (profile.id)
 * @returns The user profile with org and membership or null
 */
export async function getUserProfile(userId: string): Promise<UserProfileWithOrg | null> {
  try {
    const { data: membership, error } = await supabase
      .from('memberships')
      .select('*, profiles(*), orgs(*)')
      .eq('profile_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching user profile:', error)
      throw error
    }

    if (!membership) {
      return null
    }

    return {
      profile: membership.profiles as Profile,
      membership: membership,
      org: membership.orgs as Org,
    }
  } catch (error) {
    console.error('Error getting user profile:', error)
    return null
  }
}

/**
 * Check if user needs profile sync
 * Returns true if user exists in auth but not in profiles or has no membership
 * 
 * @param userId - The user ID from Supabase Auth (profile.id)
 * @returns Boolean indicating if sync is needed
 */
export async function needsProfileSync(userId: string): Promise<boolean> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('Error checking profile:', profileError)
      return true // Assume sync is needed if there's an error
    }

    if (!profile) {
      return true // Needs profile
    }

    // Check if user has a membership
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('id')
      .eq('profile_id', userId)
      .maybeSingle()

    if (membershipError) {
      console.error('Error checking membership:', membershipError)
      return true
    }

    return !membership // Needs sync if no membership found
  } catch (error) {
    console.error('Error in needsProfileSync:', error)
    return true
  }
}

