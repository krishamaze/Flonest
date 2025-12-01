import { createPortal } from 'react-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect } from 'react'

export interface ActionSheetItem {
    id: string
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: 'default' | 'destructive'
    disabled?: boolean
}

interface ActionSheetProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    items: ActionSheetItem[]
}

export function ActionSheet({ isOpen, onClose, title, items }: ActionSheetProps) {
    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-end justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'action-sheet-title' : undefined}
        >
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/25 animate-fade-in"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Action Sheet */}
            <div
                className="relative z-10 w-full max-w-md transform overflow-hidden rounded-t-2xl bg-bg-card shadow-xl animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                        <h3 id="action-sheet-title" className="text-base font-medium text-primary-text">
                            {title}
                        </h3>
                        <button
                            onClick={onClose}
                            className="rounded-md p-1.5 text-muted-text hover:bg-neutral-100 transition-colors"
                            aria-label="Close"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {/* Actions */}
                <div className="p-2">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                item.onClick()
                                onClose()
                            }}
                            disabled={item.disabled}
                            className={`
                flex w-full items-center gap-3 rounded-lg px-4 py-3
                min-h-[44px] text-left transition-colors
                ${item.variant === 'destructive'
                                    ? 'text-error hover:bg-error/10'
                                    : 'text-primary-text hover:bg-neutral-100'
                                }
                ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
                        >
                            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                            <span className="text-sm font-medium">{item.label}</span>
                        </button>
                    ))}
                </div>

                {/* Safe area for mobile */}
                <div className="h-4" />
            </div>
        </div>,
        document.body
    )
}
