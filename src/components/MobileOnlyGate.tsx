/**
 * MobileOnlyGate - Blocks desktop users and shows a message
 * This component is displayed when the app is accessed from a desktop browser in production
 */

export function MobileOnlyGate() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-page px-md py-3xl">
      <div className="w-full max-w-md text-center">
        {/* App Icon/Logo - matching Header component style */}
        <div className="mx-auto mb-lg flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
          <span className="text-3xl font-bold text-on-primary">I</span>
        </div>

        {/* Main Message */}
        <h1 className="mb-md text-2xl font-semibold text-primary-text">
          Inventory Management System
        </h1>
        
        <div className="rounded-md bg-bg-card p-2xl shadow-sm border border-neutral-200">
          <p className="text-lg text-secondary-text mb-sm">
            Access allowed only on mobile browsers.
          </p>
          
          <p className="mt-md text-sm text-secondary-text">
            Please open this app on your mobile device or tablet to continue.
          </p>
        </div>

        {/* Additional Instructions */}
        <div className="mt-lg rounded-md bg-neutral-50 border border-neutral-200 p-md">
          <p className="text-sm text-primary-text font-medium mb-xs">
            How to access on mobile:
          </p>
          <p className="text-xs text-secondary-text">
            Open this URL on your mobile browser or scan the QR code if available.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-lg text-center text-xs text-muted-text">
          Mobile-first Progressive Web App
        </p>
      </div>
    </div>
  )
}

