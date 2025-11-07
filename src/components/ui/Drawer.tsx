import { ReactNode, useEffect, useRef } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  headerAction?: ReactNode
}

export function Drawer({ isOpen, onClose, title, children, className = '', headerAction }: DrawerProps) {
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

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[101] transform transition-transform duration-300 ease-out safe-bottom ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        } ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
      >
        <div 
          ref={drawerRef}
          className="mx-auto max-h-[90vh] w-full max-w-lg rounded-t-2xl bg-bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-2">
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
            <div className="flex items-center justify-between border-b border-neutral-200 px-lg py-md">
              {title && <h2 id="drawer-title" className="text-xl font-semibold text-primary-text">{title}</h2>}
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
          <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-lg py-md safe-bottom">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}

