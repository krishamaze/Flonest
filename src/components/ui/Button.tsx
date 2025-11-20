import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  // Base classes using Tailwind with design tokens
  const baseClasses = 'inline-flex items-center justify-center gap-sm rounded-md font-medium transition-all duration-150 min-h-[44px] min-w-[44px] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]'
  
  const variantClasses = {
    primary: 'bg-primary text-on-primary font-semibold shadow-sm hover:bg-primary-hover hover:shadow-md active:shadow-xs',
    secondary: 'bg-neutral-200 text-primary-text font-medium hover:bg-neutral-300',
    danger: 'bg-error text-on-dark font-semibold hover:bg-error-dark',
    ghost: 'bg-transparent text-secondary-text font-medium hover:bg-bg-hover',
  }

  const sizeClasses = {
    sm: 'px-sm py-sm text-sm',
    md: 'px-md py-sm text-base',
    lg: 'px-lg py-md text-lg min-h-[48px]',
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && (
        <div 
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      )}
      <span className={isLoading ? 'opacity-70' : ''}>{children}</span>
    </button>
  )
}

