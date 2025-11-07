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
      <div className="form-group">
        {label && (
          <label className="form-label block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600 ml-1" aria-label="required">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={`input w-full rounded-lg border min-h-[44px] ${
            error ? 'border-red-500' : 'border-gray-300'
          } bg-white px-4 py-2.5 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none bg-[url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")] bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat pr-10 ${className}`}
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

Select.displayName = 'Select'

