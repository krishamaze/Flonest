import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`card bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm ${
        onClick ? 'cursor-pointer hover:shadow-md transition-all duration-200' : ''
      } ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return <div className={`px-4 pt-4 pb-2 ${className}`}>{children}</div>
}

interface CardTitleProps {
  children: ReactNode
  className?: string
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return <h3 className={`text-base font-semibold text-gray-900 ${className}`}>{children}</h3>
}

interface CardContentProps {
  children: ReactNode
  className?: string
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={className}>{children}</div>
}

