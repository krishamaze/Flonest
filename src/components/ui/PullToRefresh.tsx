import { useState, useRef, useEffect, ReactNode } from 'react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  disabled?: boolean
  threshold?: number // px to trigger refresh (default 80)
  maxPull?: number // max pull distance (default 120)
}

type RefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing'

export function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
  threshold = 80,
  maxPull = 120,
}: PullToRefreshProps) {
  const [state, setState] = useState<RefreshState>('idle')
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const touchStartY = useRef(0)
  const scrollableElement = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  useEffect(() => {
    if (disabled) return

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return
      
      const scrollable = scrollableElement.current
      if (!scrollable) return

      // Only activate if scrolled to top
      const isAtTop = scrollable.scrollTop === 0
      if (!isAtTop) return

      touchStartY.current = e.touches[0].clientY
      isDragging.current = false
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing) return
      
      const scrollable = scrollableElement.current
      if (!scrollable) return

      const isAtTop = scrollable.scrollTop === 0
      if (!isAtTop && !isDragging.current) return

      const currentY = e.touches[0].clientY
      const diff = currentY - touchStartY.current

      // Only activate on downward pull
      if (diff > 0 && isAtTop) {
        // Prevent default scroll behavior while pulling
        if (diff > 5) {
          e.preventDefault()
          isDragging.current = true
        }

        // Apply resistance - pulls get harder as you go further
        const resistance = 2.5
        const distance = Math.min(diff / resistance, maxPull)
        
        setPullDistance(distance)

        if (distance >= threshold) {
          setState('ready')
        } else if (distance > 0) {
          setState('pulling')
        }
      }
    }

    const handleTouchEnd = async () => {
      if (isRefreshing) return

      isDragging.current = false

      if (state === 'ready' && pullDistance >= threshold) {
        setState('refreshing')
        setIsRefreshing(true)

        try {
          await onRefresh()
        } catch (error) {
          console.error('Refresh error:', error)
        } finally {
          // Delay to show completion state
          setTimeout(() => {
            setPullDistance(0)
            setState('idle')
            setIsRefreshing(false)
          }, 300)
        }
      } else {
        // Snap back
        setPullDistance(0)
        setState('idle')
      }
    }

    const element = scrollableElement.current
    if (!element) return

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [disabled, state, pullDistance, threshold, maxPull, onRefresh, isRefreshing])

  // Calculate indicator opacity and scale based on pull distance
  const progress = Math.min(pullDistance / threshold, 1)
  const indicatorOpacity = Math.min(progress * 1.5, 1)
  const indicatorScale = 0.5 + progress * 0.5

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Pull Indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-50 pointer-events-none"
        style={{
          height: `${pullDistance}px`,
          opacity: indicatorOpacity,
          transition: state === 'idle' ? 'height 0.3s ease-out, opacity 0.2s ease-out' : 'none',
        }}
      >
        <div
          className="flex flex-col items-center gap-xs"
          style={{
            transform: `scale(${indicatorScale})`,
            transition: state === 'idle' ? 'transform 0.3s ease-out' : 'none',
          }}
        >
          {/* Spinner/Icon */}
          <div className="relative w-8 h-8">
            {state === 'refreshing' ? (
              // Spinning loader
              <div
                className="w-full h-full rounded-full border-3 border-solid"
                style={{
                  borderColor: 'var(--color-neutral-200)',
                  borderTopColor: 'var(--color-primary)',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            ) : (
              // Arrow or pull indicator
              <div
                className="w-full h-full rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--text-on-primary)',
                  transform: state === 'ready' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease-out',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 12V4M8 4L4 8M8 4L12 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Status Text */}
          {pullDistance > 20 && (
            <p
              className="text-xs font-medium text-center whitespace-nowrap"
              style={{
                color: 'var(--text-secondary)',
              }}
            >
              {state === 'refreshing'
                ? 'Refreshing...'
                : state === 'ready'
                ? 'Release to refresh'
                : 'Pull to refresh'}
            </p>
          )}
        </div>
      </div>

      {/* Content - shifts down while pulling */}
      <div
        ref={scrollableElement}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: state === 'idle' ? 'transform 0.3s ease-out' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}

