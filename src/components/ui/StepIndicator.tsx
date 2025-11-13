import { CheckIcon } from '@heroicons/react/24/solid'

interface StepIndicatorProps {
  currentStep: number
  stepLabels: string[]
}

export function StepIndicator({ currentStep, stepLabels }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-sm mb-lg">
      {stepLabels.map((label, index) => {
        const stepNumber = index + 1
        const isCompleted = stepNumber < currentStep
        const isCurrent = stepNumber === currentStep
        
        return (
          <div key={stepNumber} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                  isCompleted
                    ? 'bg-primary text-on-primary'
                    : isCurrent
                    ? 'bg-primary text-on-primary ring-2 ring-primary ring-offset-2'
                    : 'bg-neutral-200 text-neutral-500'
                }`}
              >
                {isCompleted ? (
                  <CheckIcon className="w-5 h-5" />
                ) : (
                  stepNumber
                )}
              </div>
              <span
                className={`text-xs mt-xs text-center max-w-[80px] ${
                  isCurrent ? 'text-primary font-medium' : 'text-secondary-text'
                }`}
              >
                {label}
              </span>
            </div>
            
            {/* Connector Line */}
            {index < stepLabels.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-sm transition-all duration-200 ${
                  isCompleted ? 'bg-primary' : 'bg-neutral-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

