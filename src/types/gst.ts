/**
 * GST-related type definitions
 * Centralized types for GST verification status and related enums
 */

/**
 * GST verification status values
 * Must match database CHECK constraint: 'unverified' | 'verified'
 */
export type GstVerificationStatus = 'unverified' | 'verified'

/**
 * GST verification source values
 * Tracks how GSTIN was initially captured
 */
export type GstVerificationSource = 'manual' | 'cashfree' | 'secureid'

