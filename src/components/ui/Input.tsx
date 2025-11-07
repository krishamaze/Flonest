import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  required?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, required, className = '', type = 'text', ...props }, ref) => {
    // Determine appropriate input type for mobile keyboards
    const inputType = type === 'number' ? 'number' : 
                     type === 'email' ? 'email' : 
                     type === 'tel' ? 'tel' : 
                     type === 'url' ? 'url' : 
                     'text'

    // Determine inputMode for better mobile keyboard
    const inputMode = type === 'number' ? 'numeric' : 
                     type === 'email' ? 'email' : 
                     type === 'tel' ? 'tel' : 
                     undefined

    return (
      <div className="mb-md">
        {label && (
          <label className="block text-sm font-medium text-secondary-text mb-xs">
            {label}
            {required && (
              <span className="text-error ml-xs" aria-label="required">*</span>
            )}
          </label>
        )}
        <input
          ref={ref}
          type={inputType}
          inputMode={inputMode}
          className={`w-full min-h-[44px] px-md py-sm border rounded-md bg-bg-card text-base text-primary-text placeholder:text-muted-text focus:border-primary focus:outline-2 focus:outline-primary focus:outline-offset-2 disabled:bg-neutral-100 disabled:text-muted-text disabled:cursor-not-allowed transition-all duration-150 ${
            error ? 'border-error focus:outline-error' : 'border-neutral-300'
          } ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${props.id || 'input'}-error` : undefined}
          required={required}
          {...props}
        />
        {error && (
          <p 
            id={`${props.id || 'input'}-error`}
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

Input.displayName = 'Input'

