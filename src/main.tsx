import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'

// Register service worker for PWA (deferred to not block initial render)
if ('serviceWorker' in navigator) {
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

