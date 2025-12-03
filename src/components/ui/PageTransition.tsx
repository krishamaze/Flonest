import { ReactNode, useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
  children: ReactNode
}

/**
 * PageTransition Component
 * Wraps route content with smooth Android-style fade transitions
 *
 * Uses opacity-only transition without key-based remount to avoid
 * breaking React Router's route reconciliation when navigating
 * between routes with different layout structures (e.g., focus pages
 * outside MainLayout vs nested routes inside MainLayout).
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevPathnameRef = useRef(location.pathname)
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Cancel any pending transition when new navigation occurs
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }

    if (location.pathname !== prevPathnameRef.current) {
      // Start fade out
      setIsTransitioning(true)

      // After brief fade, update ref and fade back in
      transitionTimerRef.current = setTimeout(() => {
        prevPathnameRef.current = location.pathname
        setIsTransitioning(false)
        transitionTimerRef.current = null
      }, 100) // Reduced from 150ms for snappier feel
    }

    // Cleanup on unmount
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
        transitionTimerRef.current = null
      }
    }
  }, [location.pathname])

  return (
    <div
      className="page-enter"
      style={{
        opacity: isTransitioning ? 0.3 : 1, // Subtle fade instead of full disappear
        transition: 'opacity 100ms ease-out',
      }}
    >
      {children}
    </div>
  )
}

