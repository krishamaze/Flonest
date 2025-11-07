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
      <div className="form-group">
        {label && (
          <label className="form-label block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600 ml-1" aria-label="required">*</span>}
          </label>
        )}
        <input
          ref={ref}
          type={inputType}
          inputMode={inputMode}
          className={`input w-full rounded-lg border min-h-[44px] ${
            error ? 'border-red-500' : 'border-gray-300'
          } bg-white px-4 py-2.5 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${props.id || 'input'}-error` : undefined}
          required={required}
          {...props}
        />
        {error && (
          <p 
            id={`${props.id || 'input'}-error`}
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

Input.displayName = 'Input'

