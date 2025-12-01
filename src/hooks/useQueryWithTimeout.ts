import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { useState, useEffect } from 'react'

export type EnhancedQueryResult<TData, TError> = UseQueryResult<TData, TError> & {
  isTimeout: boolean
  timeoutDuration: number
}

/**
 * Enhanced useQuery hook with built-in timeout detection
 * Automatically tracks if a query is taking longer than expected
 * 
 * @param options - Standard React Query options
 * @param timeoutMs - Milliseconds before marking as timeout (default: 15000)
 */
export function useQueryWithTimeout<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData>,
  timeoutMs: number = 15000
): EnhancedQueryResult<TData, TError> {
  const queryResult = useQuery(options)
  const [isTimeout, setIsTimeout] = useState(false)

  useEffect(() => {
    if (!queryResult.isLoading) {
      setIsTimeout(false)
      return
    }

    const timer = setTimeout(() => {
      if (queryResult.isLoading) {
        setIsTimeout(true)
      }
    }, timeoutMs)

    return () => clearTimeout(timer)
  }, [queryResult.isLoading, timeoutMs])

  return {
    ...queryResult,
    isTimeout,
    timeoutDuration: timeoutMs,
  }
}
