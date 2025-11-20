import { TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  required?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, required, className = '', rows = 3, ...props }, ref) => {
    return (
      <div className="mb-md">
        {label && (
          <label className="block text-base font-medium text-secondary-text mb-xs">
            {label}
            {required && (
              <span className="text-error ml-xs" aria-label="required">*</span>
            )}
          </label>
        )}
        <textarea
          ref={ref}
          rows={rows}
          className={`w-full min-h-[100px] px-md py-3 border rounded-md bg-bg-card text-base text-primary-text placeholder:text-muted-text focus:border-primary focus:bg-white focus:outline-1 focus:outline-primary focus:outline-offset-1 disabled:bg-neutral-100 disabled:text-muted-text disabled:cursor-not-allowed transition-all duration-150 resize-vertical ${
            error ? 'border-error focus:outline-error' : 'border-neutral-400'
          } ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${props.id || 'textarea'}-error` : undefined}
          required={required}
          {...props}
        />
        {error && (
          <p 
            id={`${props.id || 'textarea'}-error`}
            className="mt-xs text-sm text-error-dark" 
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

