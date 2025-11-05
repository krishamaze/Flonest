import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { MobileOnlyGate } from './components/MobileOnlyGate.tsx'
import { isMobileDevice } from './lib/deviceDetection.ts'
import './styles/index.css'

// Check device type
const isMobile = isMobileDevice()

// Register service worker for PWA only on mobile devices (deferred to not block initial render)
if (isMobile && 'serviceWorker' in navigator) {
  // Use requestIdleCallback if available, otherwise setTimeout
  const registerSW = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed, app will still work
    })
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(registerSW, { timeout: 2000 })
  } else {
    setTimeout(registerSW, 2000)
  }
}

// Render app based on device type
const root = createRoot(document.getElementById('root')!)

if (isMobile) {
  // Mobile device: render full app
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} else {
  // Desktop device: show blocking message
  root.render(
    <StrictMode>
      <MobileOnlyGate />
    </StrictMode>,
  )
}

