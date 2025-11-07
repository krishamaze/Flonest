import { TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  required?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, required, className = '', rows = 3, ...props }, ref) => {
    return (
      <div className="form-group">
        {label && (
          <label className="form-label block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600 ml-1" aria-label="required">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          rows={rows}
          className={`input w-full rounded-lg border min-h-[100px] ${
            error ? 'border-red-500' : 'border-gray-300'
          } bg-white px-4 py-2.5 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-vertical transition-all disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${props.id || 'textarea'}-error` : undefined}
          required={required}
          {...props}
        />
        {error && (
          <p 
            id={`${props.id || 'textarea'}-error`}
            className="mt-1 text-sm text-red-600" 
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

