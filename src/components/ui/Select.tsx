import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  required?: boolean
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, required, options, className = '', ...props }, ref) => {
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
        <select
          ref={ref}
          className={`w-full min-h-[44px] px-md py-sm border rounded-md bg-bg-card text-base text-primary-text focus:border-primary focus:outline-2 focus:outline-primary focus:outline-offset-2 disabled:bg-neutral-100 disabled:text-muted-text disabled:cursor-not-allowed transition-all duration-150 appearance-none bg-[url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-[2.5rem] ${
            error ? 'border-error focus:outline-error' : 'border-neutral-300'
          } ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${props.id || 'select'}-error` : undefined}
          required={required}
          {...props}
        >
          {!required && <option value="">Select an option</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p 
            id={`${props.id || 'select'}-error`}
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

Select.displayName = 'Select'

