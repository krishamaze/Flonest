import { useState, useEffect } from 'react'

/**
 * Custom hook to detect if viewport is mobile-sized
 * Mobile breakpoint: < 768px (matches md: breakpoint in Tailwind)
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    // Set initial value
    handleResize()

    // Listen for resize events
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])

  return isMobile
}
