import { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Database } from '../types/database'

type TeamMember = Database['public']['Tables']['team_members']['Row']
type TenantInsert = Database['public']['Tables']['tenants']['Insert']
type TeamMemberInsert = Database['public']['Tables']['team_members']['Insert']

/**
 * Sync authenticated user to team_members table
 * This ensures every authenticated user has a profile in the team_members table
 *
 * @param authUser - The authenticated user from Supabase Auth
 * @returns The team_members record or null if sync failed
 */
export async function syncUserProfile(authUser: User): Promise<TeamMember | null> {
  try {
    // Check if user already exists in team_members
    const { data: existingMember, error: checkError } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing team member:', checkError)
      throw checkError
    }

    // If user already exists, return the existing record
    if (existingMember) {
      console.log('User already exists in team_members:', existingMember)
      return existingMember
    }

    // User doesn't exist, need to create a profile
    // First, check if there are any tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name')
      .limit(1)

    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError)
      throw tenantsError
    }

    // If no tenants exist, create a default tenant for this user
    let tenantId: string

    if (!tenants || tenants.length === 0) {
      console.log('No tenants found, creating default tenant...')

      const tenantData: TenantInsert = {
        name: `${authUser.email?.split('@')[0]}'s Company`,
        slug: `${authUser.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        state: 'Default', // Default state, user can update later
        gst_enabled: false,
      }

      const { data: newTenant, error: createTenantError } = await (supabase
        .from('tenants')
        .insert([tenantData] as any)
        .select()
        .single() as any)

      if (createTenantError || !newTenant) {
        console.error('Error creating tenant:', createTenantError)
        throw createTenantError
      }

      tenantId = newTenant.id
      console.log('Created new tenant:', newTenant)
    } else {
      // Use the first available tenant
      tenantId = (tenants[0] as any).id
      console.log('Using existing tenant:', tenants[0])
    }

    // Create team_members record
    const memberData: TeamMemberInsert = {
      tenant_id: tenantId,
      user_id: authUser.id,
      email: authUser.email || '',
      role: 'owner', // First user is always owner
    }

    const { data: newMember, error: createMemberError } = await (supabase
      .from('team_members')
      .insert([memberData] as any)
      .select()
      .single() as any)

    if (createMemberError || !newMember) {
      console.error('Error creating team member:', createMemberError)
      throw createMemberError
    }

    console.log('Successfully created team member:', newMember)
    return newMember
  } catch (error) {
    console.error('Error syncing user profile:', error)
    return null
  }
}

/**
 * Get user profile from team_members table
 *
 * @param userId - The user ID from Supabase Auth
 * @returns The team_members record or null
 */
export async function getUserProfile(userId: string): Promise<TeamMember | null> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching user profile:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error getting user profile:', error)
    return null
  }
}

/**
 * Check if user needs profile sync
 * Returns true if user exists in auth but not in team_members
 * 
 * @param userId - The user ID from Supabase Auth
 * @returns Boolean indicating if sync is needed
 */
export async function needsProfileSync(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error checking profile sync status:', error)
      return true // Assume sync is needed if there's an error
    }

    return !data // Needs sync if no data found
  } catch (error) {
    console.error('Error in needsProfileSync:', error)
    return true
  }
}

