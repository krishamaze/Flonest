import { Outlet } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { PullToRefresh } from '../ui/PullToRefresh'
import { RefreshProvider, useRefresh } from '../../contexts/RefreshContext'

function MainLayoutContent() {
  const { refresh, registerServiceWorker } = useRefresh()

  // Register service worker with RefreshContext for pull-to-refresh
  useRegisterSW({
    onRegistered(registration) {
      console.log('SW registered in MainLayout:', registration)
      // Share SW registration with RefreshContext for pull-to-refresh
      registerServiceWorker(registration)
    },
    onRegisterError(error) {
      console.error('SW registration error:', error)
    },
  })

  const handleRefresh = async () => {
    // Call the refresh flow (SW update check + data refresh)
    await refresh()
  }

  return (
    <div className="flex viewport-height flex-col bg-bg-page overflow-hidden">
      <Header />
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="pb-20 safe-bottom px-md">
          <div className="container-mobile mx-auto max-w-7xl py-md">
            <Outlet />
          </div>
        </main>
      </PullToRefresh>
      <BottomNav />
    </div>
  )
}

export function MainLayout() {
  return (
    <RefreshProvider>
      <MainLayoutContent />
    </RefreshProvider>
  )
}

