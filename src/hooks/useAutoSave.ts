import { useEffect, useRef, useState } from 'react'

interface UseAutoSaveOptions {
  localDebounce?: number // LocalStorage debounce in milliseconds (default: 1500)
  rpcInterval?: number // RPC auto-save interval in milliseconds (default: 5000)
  enabled?: boolean // Enable/disable auto-save
  onSave?: () => void // Callback when save is triggered
}

/**
 * useAutoSave Hook
 * Auto-saves data to localStorage and calls save function at intervals
 * Handles offline gracefully (queues for when online)
 */
export function useAutoSave<T>(
  data: T,
  saveFn: (data: T) => Promise<void> | void,
  options: UseAutoSaveOptions = {}
) {
  const { localDebounce = 1500, rpcInterval = 5000, enabled = true, onSave } = options
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const localDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const dataRef = useRef<T>(data)
  const saveFnRef = useRef(saveFn)

  // Update refs when data/saveFn changes
  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    saveFnRef.current = saveFn
  }, [saveFn])

  // Save to localStorage with debounce on data change
  useEffect(() => {
    if (!enabled) return

    // Clear existing debounce timeout
    if (localDebounceRef.current) {
      clearTimeout(localDebounceRef.current)
    }

    // Set new debounced save
    localDebounceRef.current = setTimeout(() => {
      try {
        const key = 'invoice_draft'
        localStorage.setItem(key, JSON.stringify(data))
      } catch (error) {
        console.error('Failed to save to localStorage:', error)
      }
    }, localDebounce)

    return () => {
      if (localDebounceRef.current) {
        clearTimeout(localDebounceRef.current)
      }
    }
  }, [data, enabled, localDebounce])

  // Auto-save function
  const performSave = async () => {
    if (!enabled || isSaving) return

    setIsSaving(true)
    setSaveStatus('saving')

    try {
      // Check if online
      if (!navigator.onLine) {
        console.log('Offline: Save queued for when online')
        setSaveStatus('idle')
        setIsSaving(false)
        return
      }

      // Call save function
      await saveFnRef.current(dataRef.current)
      
      setSaveStatus('saved')
      setLastSaved(new Date())
      onSave?.()

      // Reset status after 2 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 2000)
    } catch (error) {
      console.error('Auto-save failed:', error)
      setSaveStatus('error')
      
      // Reset error status after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)
    } finally {
      setIsSaving(false)
    }
  }

  // Set up interval for auto-save
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      performSave()
    }, rpcInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, rpcInterval])

  // Manual save function
  const manualSave = async () => {
    await performSave()
  }

  // Restore from localStorage
  const restoreFromLocalStorage = (): T | null => {
    try {
      const key = 'invoice_draft'
      const stored = localStorage.getItem(key)
      if (stored) {
        return JSON.parse(stored) as T
      }
    } catch (error) {
      console.error('Failed to restore from localStorage:', error)
    }
    return null
  }

  // Clear localStorage
  const clearDraft = () => {
    try {
      const key = 'invoice_draft'
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Failed to clear localStorage:', error)
    }
  }

  return {
    isSaving,
    lastSaved,
    saveStatus,
    manualSave,
    restoreFromLocalStorage,
    clearDraft,
  }
}

