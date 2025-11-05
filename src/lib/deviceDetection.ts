/**
 * Device detection utility to identify mobile devices
 * Uses multiple detection methods for accurate identification
 */

/**
 * Checks if desktop access should be allowed (development mode only)
 * @returns true if in development mode, false in production
 */
export function isDevelopmentMode(): boolean {
  // In Vite, import.meta.env.DEV is true in development, false in production
  return import.meta.env.DEV === true
}

/**
 * Detects if the current device is a mobile device
 * @returns true if device is mobile/tablet, false if desktop
 */
export function isMobileDevice(): boolean {
  // Check user agent for mobile patterns
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
  
  // Mobile user agent patterns
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
    /Mobile/i,
    /Tablet/i
  ]
  
  // Check if user agent matches mobile patterns
  const isMobileUserAgent = mobilePatterns.some(pattern => pattern.test(userAgent))
  
  // Check for touch support (primary indicator of mobile)
  const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  
  // Check screen width (mobile typically < 768px, but allow up to 1024px for tablets)
  const screenWidth = window.innerWidth || document.documentElement.clientWidth
  const isSmallScreen = screenWidth < 1024
  
  // Combined logic: mobile if (user agent matches OR has touch) AND small screen
  // OR if user agent clearly indicates mobile/tablet regardless of screen size
  const isMobile = 
    (isMobileUserAgent || hasTouchSupport) && isSmallScreen ||
    isMobileUserAgent && (hasTouchSupport || screenWidth < 1200)
  
  return isMobile
}

/**
 * Determines if the app should allow access (mobile devices or development mode)
 * @returns true if access should be allowed, false if blocked
 * 
 * NOTE: Temporarily allowing desktop access for testing purposes
 */
export function shouldAllowAccess(): boolean {
  // TEMPORARY: Allow all access for testing
  // TODO: Re-enable mobile-only restriction after testing
  return true
  
  // Original logic (commented out for testing):
  // return isMobileDevice() || isDevelopmentMode()
}

