import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'

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
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                {/* Backdrop */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/25" />
                </Transition.Child>

                {/* Sheet Container */}
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="translate-y-full"
                            enterTo="translate-y-0"
                            leave="ease-in duration-150"
                            leaveFrom="translate-y-0"
                            leaveTo="translate-y-full"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-t-2xl bg-bg-card shadow-xl transition-all">
                                {/* Header */}
                                {title && (
                                    <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                                        <Dialog.Title className="text-base font-medium text-primary-text">
                                            {title}
                                        </Dialog.Title>
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
                                <div className="pb-safe" />
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
