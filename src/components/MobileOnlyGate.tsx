/**
 * MobileOnlyGate - Blocks desktop users and shows a message
 * This component is displayed when the app is accessed from a desktop browser
 */

export function MobileOnlyGate() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md text-center">
        {/* App Icon/Logo - matching Header component style */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg">
          <span className="text-3xl font-bold text-white">I</span>
        </div>

        {/* Main Message */}
        <h1 className="mb-4 text-2xl font-semibold text-gray-900">
          Inventory Management System
        </h1>
        
        <div className="rounded-lg bg-white p-8 shadow-sm border border-gray-200">
          <p className="text-lg text-gray-700 mb-2">
            Access allowed only on mobile browsers.
          </p>
          
          <p className="mt-4 text-sm text-gray-600">
            Please open this app on your mobile device or tablet to continue.
          </p>
        </div>

        {/* Additional Instructions */}
        <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm text-blue-800 font-medium mb-1">
            How to access on mobile:
          </p>
          <p className="text-xs text-blue-600">
            Open this URL on your mobile browser or scan the QR code if available.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          Mobile-first Progressive Web App
        </p>
      </div>
    </div>
  )
}

