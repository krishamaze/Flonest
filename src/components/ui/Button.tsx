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
  // Base classes with design tokens - minimum 44px height for touch targets
  const baseClasses = 'btn inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
  
  const variantClasses = {
    primary: 'bg-primary-600 text-black hover:bg-primary-700 focus-visible:ring-primary-600 font-semibold',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus-visible:ring-gray-500 font-medium',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 font-semibold',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500 font-medium',
  }

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[44px]',
    md: 'px-4 py-2.5 text-base min-h-[44px]',
    lg: 'px-6 py-3 text-lg min-h-[48px]',
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
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" 
          aria-hidden="true"
        />
      )}
      <span className={isLoading ? 'opacity-70' : ''}>{children}</span>
    </button>
  )
}

