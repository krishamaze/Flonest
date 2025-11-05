/**
 * Device detection utility to identify mobile devices
 * Uses multiple detection methods for accurate identification
 */

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

