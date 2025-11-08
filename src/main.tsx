import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { MobileOnlyGate } from './components/MobileOnlyGate.tsx'
import { shouldAllowAccess } from './lib/deviceDetection.ts'
import './styles/index.css'

// Check device type and access permissions
const allowAccess = shouldAllowAccess()

// PWA service worker is automatically registered by Vite PWA plugin
// No manual registration needed - handled by virtual:pwa-register

// Render app based on device type and environment
const root = createRoot(document.getElementById('root')!)

if (allowAccess) {
  // Mobile device or development mode: render full app
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} else {
  // Desktop device in production: show blocking message
  root.render(
    <StrictMode>
      <MobileOnlyGate />
    </StrictMode>,
  )
}

