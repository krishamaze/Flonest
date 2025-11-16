/**
 * Organization API helpers
 * Handles org updates and queries
 */

import { supabase } from '../supabase'
import type { Org } from '../../types'

export interface UpdateOrgData {
  name?: string
  state?: string
  pincode?: string
  gst_number?: string
  gst_enabled?: boolean
  // Verification fields are NOT allowed here - they can only be set via platform-admin RPC
  slug?: string
}

/**
 * Update organization details
 * @param orgId - Organization ID
 * @param data - Fields to update
 * @returns Updated organization
 */
export async function updateOrg(orgId: string, data: UpdateOrgData): Promise<Org> {
  // Convert undefined to null for Supabase (which expects null for nullable fields)
  const updatePayload: Record<string, any> = {
    ...data,
    updated_at: new Date().toISOString(),
  }
  
  // Convert undefined to null for nullable fields
  if (updatePayload.gst_number === undefined) {
    updatePayload.gst_number = null
  }
  if (updatePayload.pincode === undefined) {
    updatePayload.pincode = null
  }
  
  // Explicitly remove any verification fields that might have been passed (defense in depth)
  delete updatePayload.gst_verification_status
  delete updatePayload.gst_verification_source
  delete updatePayload.gst_verified_at
  delete updatePayload.gst_verified_by
  delete updatePayload.gst_verification_notes

  const { data: updatedOrg, error } = await supabase
    .from('orgs')
    .update(updatePayload)
    .eq('id', orgId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (!updatedOrg) {
    throw new Error('Failed to update organization')
  }

  return updatedOrg
}

/**
 * Get organization by ID
 * @param orgId - Organization ID
 * @returns Organization or null
 */
export async function getOrgById(orgId: string): Promise<Org | null> {
  const { data, error } = await supabase
    .from('orgs')
    .select('*')
    .eq('id', orgId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

/**
 * Check if slug is already taken
 * @param slug - Slug to check
 * @param excludeOrgId - Org ID to exclude from check (for updates)
 * @returns true if slug is available, false if taken
 */
export async function isSlugAvailable(slug: string, excludeOrgId?: string): Promise<boolean> {
  let query = supabase
    .from('orgs')
    .select('id')
    .eq('slug', slug)
    .limit(1)

  if (excludeOrgId) {
    query = query.neq('id', excludeOrgId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return !data || data.length === 0
}

/**
 * Generate unique slug from organization name
 * @param name - Organization name
 * @param orgId - Optional org ID to exclude from uniqueness check
 * @returns Unique slug
 */
export async function generateUniqueSlug(name: string, orgId?: string): Promise<string> {
  // Generate base slug: lowercase, replace spaces with hyphens, remove special chars
  let baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  // Check if base slug is available
  let slug = baseSlug
  let isAvailable = await isSlugAvailable(slug, orgId)

  // If not available, append random suffix
  if (!isAvailable) {
    const suffix = Math.random().toString(36).substring(2, 6) // 4 char random suffix
    slug = `${baseSlug}-${suffix}`
    
    // Double-check the new slug is available (very unlikely collision)
    isAvailable = await isSlugAvailable(slug, orgId)
    if (!isAvailable) {
      // If still not available, use timestamp suffix
      slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`
    }
  }

  return slug
}

/**
 * Set GST number and verification status from gst-validate Edge Function response.
 *
 * This is the only way tenant code can set verification fields – they must come from gst-validate.
 * To clear GST, pass an empty string for `gstNumber` and `gstEnabled = false`; the RPC will reset
 * all verification fields server-side and ignore `verificationStatus` / `verificationSource`.
 *
 * @param orgId - Organization ID
 * @param gstNumber - GSTIN (15 characters) or empty string to clear GST
 * @param gstEnabled - Whether GST is enabled
 * @param verificationStatus - Status from gst-validate ('unverified' | 'verified')
 * @param verificationSource - Source from gst-validate ('manual' | 'cashfree' | 'secureid')
 */
export async function setGstFromValidation(
  orgId: string,
  gstNumber: string,
  gstEnabled: boolean,
  verificationStatus: 'unverified' | 'verified',
  verificationSource: 'manual' | 'cashfree' | 'secureid'
): Promise<void> {
  const { error } = await supabase.rpc('set_gst_from_validation', {
    p_org_id: orgId,
    p_gst_number: gstNumber,
    p_gst_enabled: gstEnabled,
    p_verification_status: verificationStatus,
    p_verification_source: verificationSource,
  })

  if (error) {
    throw new Error(error.message || 'Failed to set GST from validation')
  }
}

/**
 * Mark org GSTIN as verified (platform admin only)
 * This calls the RPC function that enforces platform admin access and requires evidence notes
 * @param orgId - Organization ID
 * @param verificationNotes - Required evidence/notes about the verification
 */
export async function markGstVerified(orgId: string, verificationNotes: string): Promise<void> {
  if (!verificationNotes || !verificationNotes.trim()) {
    throw new Error('Verification notes are required')
  }

  const { error } = await supabase.rpc('mark_gst_verified', {
    p_org_id: orgId,
    p_verification_notes: verificationNotes.trim(),
  })

  if (error) {
    throw new Error(error.message || 'Failed to mark GSTIN as verified')
  }
}

