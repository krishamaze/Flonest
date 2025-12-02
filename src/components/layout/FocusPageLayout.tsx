import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface FocusPageLayoutProps {
    /** Page title displayed in header */
    title: string
    /** Content to render in scrollable area */
    children: ReactNode
    /** Optional custom back handler. Defaults to navigate(-1) */
    onBack?: () => void
    /** Optional close handler. If provided, shows close (X) button */
    onClose?: () => void
    /** Optional back destination. If provided with onBack, used for navigation */
    backTo?: string
    /** Additional class names for main content area */
    contentClassName?: string
}

/**
 * Standardized layout for full-screen focus mode pages
 * 
 * Provides:
 * - Sticky header with back button, title, and optional close button
 * - Scrollable content area
 * - Consistent styling and spacing
 * 
 * Used by: NewInvoicePage, StockLedgerPage, CustomerDetailsPage, etc.
 */
export function FocusPageLayout({
    title,
    children,
    onBack,
    onClose,
    backTo,
    contentClassName = '',
}: FocusPageLayoutProps) {
    const navigate = useNavigate()

    const handleBack = () => {
        if (onBack) {
            onBack()
        } else if (backTo) {
            navigate(backTo)
        } else {
            navigate(-1)
        }
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Sticky Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                    {/* Left: Back button */}
                    <button
                        onClick={handleBack}
                        className="p-2 -ml-2 text-muted-text hover:text-primary-text transition-colors rounded-md hover:bg-neutral-100"
                        aria-label="Go back"
                    >
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>

                    {/* Center: Title */}
                    <h1 className="text-lg font-semibold text-primary-text">{title}</h1>

                    {/* Right: Close button (optional) or spacer */}
                    {onClose ? (
                        <button
                            onClick={onClose}
                            className="p-2 -mr-2 text-muted-text hover:text-primary-text transition-colors rounded-md hover:bg-neutral-100"
                            aria-label="Close"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    ) : (
                        <div className="w-10" aria-hidden="true" />
                    )}
                </div>
            </header>

            {/* Scrollable Content */}
            <main className={`flex-1 overflow-y-auto ${contentClassName}`}>
                {children}
            </main>
        </div>
    )
}
