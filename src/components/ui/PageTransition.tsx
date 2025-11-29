import { ReactNode, useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
  children: ReactNode
}

/**
 * PageTransition Component
 * Wraps route content with smooth Android-style fade transitions
 * 
 * BUGFIX: Prevents blank screen during rapid navigation by:
 * - Canceling pending transitions when new navigation occurs
 * - Using ref to track transition timer for proper cleanup
 * - Ensuring opacity always resets to 1 after transition
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const [displayLocation, setDisplayLocation] = useState(location)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Cancel any pending transition when new navigation occurs
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }

    if (location.pathname !== displayLocation.pathname) {
      setIsTransitioning(true)

      // Update location after brief fade out
      transitionTimerRef.current = setTimeout(() => {
        setDisplayLocation(location)
        setIsTransitioning(false)
        transitionTimerRef.current = null
      }, 150)
    } else {
      // Same location - ensure we're not stuck in transitioning state
      setIsTransitioning(false)
    }

    // Cleanup on unmount or location change
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
        transitionTimerRef.current = null
      }
    }
  }, [location, displayLocation])

  return (
    <div
      className="page-enter"
      style={{
        opacity: isTransitioning ? 0 : 1,
        transition: 'opacity 150ms cubic-bezier(0.4, 0.0, 1, 1)',
        // Ensure content is always visible (prevent stuck invisible state)
        visibility: 'visible',
        display: 'block',
      }}
      key={displayLocation.pathname}
    >
      {children}
    </div>
  )
}

