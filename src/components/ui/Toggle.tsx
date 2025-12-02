interface ToggleProps {
    checked: boolean
    onChange: (checked: boolean) => void
    label?: string
    disabled?: boolean
    size?: 'sm' | 'md'
    className?: string
}

export function Toggle({
    checked,
    onChange,
    label,
    disabled = false,
    size = 'md',
    className = '',
}: ToggleProps) {
    const sizeClasses = {
        sm: {
            container: 'h-5 w-9',
            switch: 'h-4 w-4',
            translate: checked ? 'translate-x-5' : 'translate-x-0.5',
        },
        md: {
            container: 'h-6 w-11',
            switch: 'h-5 w-5',
            translate: checked ? 'translate-x-6' : 'translate-x-0.5',
        },
    }

    const sizes = sizeClasses[size]

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {label && (
                <span className="text-sm text-secondary-text select-none">
                    {label}
                </span>
            )}
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label || 'Toggle'}
                disabled={disabled}
                onClick={() => !disabled && onChange(!checked)}
                className={`
          relative inline-flex ${sizes.container} items-center rounded-full
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${checked ? 'bg-primary' : 'bg-neutral-300'}
        `}
            >
                <span
                    className={`
            inline-block ${sizes.switch} transform rounded-full bg-white
            shadow-sm transition-transform duration-200 ease-in-out
            ${sizes.translate}
          `}
                />
            </button>
        </div>
    )
}
