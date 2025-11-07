import { useEffect, useState } from 'react'
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface ToastProps {
  message: string
  type?: 'success' | 'info' | 'error'
  duration?: number
  onClose: () => void
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Wait for fade-out animation
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const bgColor = type === 'success' ? 'bg-success-light' : type === 'error' ? 'bg-error-light' : 'bg-neutral-100'
  const textColor = type === 'success' ? 'text-success-dark' : type === 'error' ? 'text-error-dark' : 'text-primary-text'
  const iconColor = type === 'success' ? 'text-success' : type === 'error' ? 'text-error' : 'text-primary'

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] px-md py-sm rounded-lg shadow-lg ${bgColor} ${textColor} flex items-center gap-sm min-w-[280px] max-w-[90vw] transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      role="alert"
    >
      {type === 'success' && <CheckCircleIcon className={`h-5 w-5 ${iconColor} flex-shrink-0`} />}
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(onClose, 300)
        }}
        className="flex-shrink-0 p-xs hover:bg-black/10 rounded-full transition-colors"
        aria-label="Close toast"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

