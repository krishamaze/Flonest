import { ReactNode, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
  children: ReactNode
}

/**
 * PageTransition Component
 * Wraps route content with smooth Android-style fade transitions
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const [displayLocation, setDisplayLocation] = useState(location)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setIsTransitioning(true)
      // Update location after brief fade out
      const timer = setTimeout(() => {
        setDisplayLocation(location)
        setIsTransitioning(false)
      }, 150)

      return () => clearTimeout(timer)
    }
  }, [location, displayLocation])

  return (
    <div
      className="page-enter"
      style={{
        opacity: isTransitioning ? 0 : 1,
        transition: 'opacity 150ms cubic-bezier(0.4, 0.0, 1, 1)',
      }}
      key={displayLocation.pathname}
    >
      {children}
    </div>
  )
}

