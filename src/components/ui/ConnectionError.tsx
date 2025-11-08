import { LoadingSpinner } from './LoadingSpinner'

interface ConnectionErrorProps {
  onRetry: () => void
  retrying: boolean
}

export function ConnectionError({ onRetry, retrying }: ConnectionErrorProps) {
  return (
    <div className="viewport-height flex items-center justify-center bg-bg-page px-md py-md">
      <div className="w-full max-w-md text-center">
        {/* Icon/Illustration */}
        <div className="mx-auto mb-lg flex h-16 w-16 items-center justify-center rounded-full bg-error-light">
          <svg
            className="h-8 w-8 text-error"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
        </div>

        {/* Main Message */}
        <h1 className="mb-sm text-xl font-semibold text-primary-text">
          Connection lost
        </h1>

        <p className="mb-lg text-sm text-secondary-text">
          Unable to connect to the server. Please check your connection and try again.
        </p>

        {/* Retry Button */}
        <button
          onClick={onRetry}
          disabled={retrying}
          className="mx-auto flex items-center justify-center gap-sm rounded-lg bg-primary px-lg py-md text-base font-semibold text-on-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover active:bg-primary-dark min-w-[200px]"
          aria-label={retrying ? 'Retrying connection...' : 'Retry connection'}
        >
          {retrying ? (
            <>
              <LoadingSpinner size="sm" label="Retrying..." />
              <span>Retrying...</span>
            </>
          ) : (
            <span>Tap to retry</span>
          )}
        </button>

        {/* Subtle retry indicator */}
        {retrying && (
          <p className="mt-md text-xs text-muted-text">
            Attempting to reconnect...
          </p>
        )}
      </div>
    </div>
  )
}

