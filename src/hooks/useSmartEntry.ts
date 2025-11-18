/**
 * useSmartEntry Hook
 * 
 * Architecture: Decoupled state machine for reactive entry logic.
 * This hook handles all business logic, debouncing, and state transitions.
 * The UI component should remain "dumb" and only render based on hook state.
 * 
 * State Machine:
 * - IDLE: Initial state, waiting for input
 * - SEARCHING: Debounce delay active, query pending
 * - SERIAL_FOUND: Level 1 resolution (Serial Number match)
 * - PRODUCT_FOUND: Level 2 resolution (SKU/Code match)
 * - UNKNOWN: Level 3 fallback (requires product creation)
 * - ERROR: Lookup failed (security, network, etc.)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { resolveEntry, type EntryResolution } from '@/lib/api/reactive-entry'

export type EntryState = 
  | { type: 'IDLE' }
  | { type: 'SEARCHING'; query: string }
  | { type: 'SERIAL_FOUND'; data: EntryResolution['type'] extends 'SERIAL_FOUND' ? EntryResolution['data'] : never }
  | { type: 'PRODUCT_FOUND'; data: EntryResolution['type'] extends 'PRODUCT_FOUND' ? EntryResolution['data'] : never; source: 'master' | 'org' }
  | { type: 'UNKNOWN'; query: string }
  | { type: 'ERROR'; message: string; query: string }

export interface UseSmartEntryOptions {
  orgId: string
  debounceMs?: number
  minQueryLength?: number
  onStateChange?: (state: EntryState) => void
}

export interface UseSmartEntryReturn {
  state: EntryState
  query: string
  setQuery: (query: string) => void
  clear: () => void
  isSearching: boolean
  reset: () => void
  executeImmediate: (query: string) => void
}

const DEFAULT_DEBOUNCE_MS = 300
const DEFAULT_MIN_QUERY_LENGTH = 1

export function useSmartEntry({
  orgId,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minQueryLength = DEFAULT_MIN_QUERY_LENGTH,
  onStateChange
}: UseSmartEntryOptions): UseSmartEntryReturn {
  const [state, setState] = useState<EntryState>({ type: 'IDLE' })
  const [query, setQueryState] = useState<string>('')
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Execute lookup
  const executeLookup = useCallback(async (searchQuery: string) => {
    if (!orgId) {
      setState({ type: 'ERROR', message: 'Organization ID is required', query: searchQuery })
      return
    }

    if (searchQuery.trim().length < minQueryLength) {
      setState({ type: 'IDLE' })
      return
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    // Set searching state
    const searchingState: EntryState = { type: 'SEARCHING', query: searchQuery }
    setState(searchingState)
    onStateChange?.(searchingState)

    try {
      const resolution = await resolveEntry(searchQuery, orgId)
      
      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return
      }

      // Map resolution to state
      let newState: EntryState
      switch (resolution.type) {
        case 'SERIAL_FOUND':
          newState = { type: 'SERIAL_FOUND', data: resolution.data }
          break
        case 'PRODUCT_FOUND':
          newState = { 
            type: 'PRODUCT_FOUND', 
            data: resolution.data, 
            source: resolution.source 
          }
          break
        case 'UNKNOWN':
          newState = { type: 'UNKNOWN', query: resolution.query }
          break
        default:
          newState = { type: 'IDLE' }
      }

      setState(newState)
      onStateChange?.(newState)
    } catch (error) {
      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      const errorState: EntryState = { 
        type: 'ERROR', 
        message: errorMessage, 
        query: searchQuery 
      }
      setState(errorState)
      onStateChange?.(errorState)
    }
  }, [orgId, minQueryLength, onStateChange])

  // Debounced setQuery
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery)

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // If query is empty, reset immediately
    if (!newQuery.trim()) {
      setState({ type: 'IDLE' })
      return
    }

    // Set debounced lookup
    debounceTimerRef.current = setTimeout(() => {
      executeLookup(newQuery)
    }, debounceMs)
  }, [debounceMs, executeLookup])

  // Clear state
  const clear = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setQueryState('')
    const idleState: EntryState = { type: 'IDLE' }
    setState(idleState)
    onStateChange?.(idleState)
  }, [onStateChange])

  // Reset to initial state (but keep query)
  const reset = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    const idleState: EntryState = { type: 'IDLE' }
    setState(idleState)
    onStateChange?.(idleState)
  }, [onStateChange])

  const isSearching = state.type === 'SEARCHING'

  // Immediate execution (bypasses debounce) - for Enter key handling
  // CRITICAL: Must clear debounce timer to prevent race condition where both
  // immediate execution and debounced execution fire, causing duplicate requests
  const executeImmediate = useCallback((immediateQuery: string) => {
    // Clear any pending debounce timer FIRST to prevent race condition
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    
    // Cancel any pending abort controller to prevent stale requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Update query state immediately
    setQueryState(immediateQuery)
    
    // Execute lookup immediately (no debounce) - timer already cleared above
    if (immediateQuery.trim().length >= minQueryLength) {
      executeLookup(immediateQuery)
    } else {
      setState({ type: 'IDLE' })
    }
  }, [executeLookup, minQueryLength])

  return {
    state,
    query,
    setQuery,
    clear,
    isSearching,
    reset,
    executeImmediate
  }
}

