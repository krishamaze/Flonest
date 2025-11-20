import { ReactNode, useEffect, useRef } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  headerAction?: ReactNode
  hideBackdrop?: boolean // Hide default backdrop (for custom z-index layering)
  customZIndex?: number // Custom z-index for drawer
}

export function Drawer({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className = '', 
  headerAction,
  hideBackdrop = false,
  customZIndex,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when drawer is open
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollbarWidth}px`
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement
      // Focus trap - focus first focusable element
      setTimeout(() => {
        const firstFocusable = drawerRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement
        firstFocusable?.focus()
      }, 100)
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      // Restore previous focus
      previousFocusRef.current?.focus()
    }

    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    // Focus trap - handle Tab key
    const handleTab = (e: KeyboardEvent) => {
      if (!isOpen || e.key !== 'Tab') return

      const drawer = drawerRef.current
      if (!drawer) return

      const focusableElements = drawer.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleTab)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleTab)
    }
  }, [isOpen, onClose])

  const drawerZIndex = customZIndex ?? 101
  const backdropZIndex = drawerZIndex - 1

  return (
    <>
      {/* Backdrop */}
      {isOpen && !hideBackdrop && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-enter"
          style={{
            zIndex: backdropZIndex,
            animation: 'fade-in 200ms cubic-bezier(0.0, 0.0, 0.2, 1)',
          }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 bottom-0 left-0 right-0 safe-top safe-bottom ${
          isOpen ? 'drawer-enter' : ''
        } ${className}`}
        style={{
          zIndex: drawerZIndex,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: isOpen
            ? 'transform 300ms cubic-bezier(0.0, 0.0, 0.2, 1)'
            : 'transform 250ms cubic-bezier(0.4, 0.0, 1, 1)',
          backgroundColor: 'white',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
      >
        <div 
          ref={drawerRef}
          className="mx-auto h-full w-full max-w-lg bg-bg-card flex flex-col"
          style={{
            boxShadow: '0 -1px 3px 0 rgba(0, 0, 0, 0.1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
            <div 
              className="h-1 w-12 rounded-full bg-neutral-300 cursor-grab active:cursor-grabbing"
              onClick={onClose}
              aria-label="Close drawer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onClose()
                }
              }}
            />
          </div>

          {/* Header */}
          {(title || headerAction) && (
            <div className="flex items-center justify-between border-b border-neutral-200 px-md py-md flex-shrink-0">
              {title && <h2 id="drawer-title" className="text-base font-normal text-primary-text">{title}</h2>}
              <div className="flex items-center gap-sm ml-auto">
                {headerAction}
                <button
                  onClick={onClose}
                  className="rounded-md p-sm min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-text hover:bg-neutral-100 hover:text-secondary-text transition-colors"
                  aria-label="Close drawer"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-md py-md min-h-0">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}

