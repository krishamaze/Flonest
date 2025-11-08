/**
 * Draft session management utilities
 * Manages draft session IDs in sessionStorage to track draft sessions across auto-saves
 */

const SESSION_KEY_PREFIX = 'draft_session_'

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
      sessionId = crypto.randomUUID()
      sessionStorage.setItem(key, sessionId)
    }

    return sessionId
  } catch (error) {
    // Fallback if sessionStorage is disabled (incognito mode, private browsing)
    console.warn('SessionStorage unavailable, using transient session ID:', error)
    return crypto.randomUUID()
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

