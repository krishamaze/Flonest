import { ReactNode, useEffect, useRef } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  headerAction?: ReactNode
}

export function Modal({ isOpen, onClose, title, children, className = '', headerAction }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollbarWidth}px`
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement
      // Focus trap - focus first focusable element
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector(
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

      const modal = modalRef.current
      if (!modal) return

      const focusableElements = modal.querySelectorAll(
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

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-md safe-top safe-bottom"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-enter z-[100]"
        style={{
          animation: 'fade-in 200ms cubic-bezier(0.0, 0.0, 0.2, 1)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative z-[101] w-full max-w-lg max-h-[90vh] rounded-lg bg-bg-card modal-enter flex flex-col ${className}`}
        style={{
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          animation: 'scale-in 200ms cubic-bezier(0.0, 0.0, 0.2, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || headerAction) && (
          <div className="flex items-center justify-between border-b border-neutral-200 px-md py-md flex-shrink-0">
            {title && <h2 id="modal-title" className="text-base font-normal text-primary-text">{title}</h2>}
            <div className="flex items-center gap-sm ml-auto">
              {headerAction}
              <button
                onClick={onClose}
                className="rounded-md p-sm min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-text hover:bg-neutral-100 hover:text-secondary-text transition-colors"
                aria-label="Close modal"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-md py-md overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>
    </div>
  )
}

