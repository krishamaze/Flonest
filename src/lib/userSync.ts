import { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Database } from '../types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Org = Database['public']['Tables']['orgs']['Row']
type Membership = Database['public']['Tables']['memberships']['Row']
type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
type OrgInsert = Database['public']['Tables']['orgs']['Insert']
type MembershipInsert = Database['public']['Tables']['memberships']['Insert']

export interface UserProfileWithOrg {
  profile: Profile
  membership: Membership
  org: Org
}

/**
 * Sync authenticated user to profiles and memberships tables
 * This ensures every authenticated user has a profile and creates an org with membership
 *
 * @param authUser - The authenticated user from Supabase Auth
 * @returns The user profile with org and membership or null if sync failed
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

    // No membership exists, create org and membership
    console.log('No membership found, creating default org...')

    const orgData: OrgInsert = {
      name: `${authUser.email?.split('@')[0]}'s Company`,
      slug: `${authUser.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      state: 'Default', // Default state, user can update later
      gst_enabled: false,
    }

    const { data: newOrg, error: createOrgError } = await supabase
      .from('orgs')
      .insert([orgData])
      .select()
      .single()

    if (createOrgError || !newOrg) {
      console.error('Error creating org:', createOrgError)
      throw createOrgError
    }

    console.log('Created new org:', newOrg)

    // Create membership
    const membershipData: MembershipInsert = {
      profile_id: authUser.id,
      org_id: newOrg.id,
      role: 'owner', // First user is always owner
    }

    const { data: newMembership, error: createMembershipError } = await supabase
      .from('memberships')
      .insert([membershipData])
      .select()
      .single()

    if (createMembershipError || !newMembership) {
      console.error('Error creating membership:', createMembershipError)
      throw createMembershipError
    }

    console.log('Successfully created membership:', newMembership)

    return {
      profile,
      membership: newMembership,
      org: newOrg,
    }
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

