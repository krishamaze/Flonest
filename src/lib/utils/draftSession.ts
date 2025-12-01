/**
 * Draft session management utilities
 * Manages draft session IDs in sessionStorage to track draft sessions across auto-saves
 */

const SESSION_KEY_PREFIX = 'draft_session_'

/**
 * Generate a UUID v4
 * Fallback for environments where crypto.randomUUID is not available
 */
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback implementation using crypto.getRandomValues or Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Get or create a draft session ID from sessionStorage
 * @param invoiceId - Optional invoice ID (for existing drafts) or 'new' for new drafts
 * @returns Draft session ID (UUID)
 */
export const getDraftSessionId = (invoiceId?: string): string => {
  try {
    const key = `${SESSION_KEY_PREFIX}${invoiceId || 'new'}`
    let sessionId = sessionStorage.getItem(key)

    if (!sessionId) {
      sessionId = generateUUID()
      sessionStorage.setItem(key, sessionId)
    }

    return sessionId
  } catch (error) {
    // Fallback if sessionStorage is disabled (incognito mode, private browsing)
    console.warn('SessionStorage unavailable, using transient session ID:', error)
    return generateUUID()
  }
}

/**
 * Store a draft session ID in sessionStorage
 * @param invoiceId - Invoice ID (required for existing drafts)
 * @param sessionId - Session ID to store
 */
export const setDraftSessionId = (invoiceId: string, sessionId: string): void => {
  try {
    const key = `${SESSION_KEY_PREFIX}${invoiceId}`
    sessionStorage.setItem(key, sessionId)
  } catch (error) {
    console.warn('Failed to store draft session ID:', error)
  }
}

/**
 * Clear a draft session ID from sessionStorage
 * Called when draft is finalized or deleted
 * @param invoiceId - Optional invoice ID, or 'new' for new draft sessions
 */
export const clearDraftSessionId = (invoiceId?: string): void => {
  try {
    const key = `${SESSION_KEY_PREFIX}${invoiceId || 'new'}`
    sessionStorage.removeItem(key)
  } catch (error) {
    console.warn('Failed to clear draft session ID:', error)
  }
}

