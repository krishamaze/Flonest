import { memo } from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

export const LoadingSpinner = memo(function LoadingSpinner({ 
  size = 'md', 
  className = '', 
  label = 'Loading...' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  return (
    <div className={`flex items-center justify-center ${className}`} role="status" aria-label={label}>
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-neutral-200 border-t-primary`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  )
})

