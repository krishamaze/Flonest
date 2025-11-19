import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { PullToRefresh } from '../ui/PullToRefresh'
import { RefreshProvider, useRefresh } from '../../contexts/RefreshContext'
import { useServiceWorker } from '../../contexts/ServiceWorkerContext'

function MainLayoutContent() {
  const { refresh, registerServiceWorker } = useRefresh()
  const { registration } = useServiceWorker()

  // Share SW registration with RefreshContext for pull-to-refresh
  if (registration) {
    registerServiceWorker(registration)
  }

  const handleRefresh = async () => {
    // Call the refresh flow (SW update check + data refresh)
    await refresh()
  }

  return (
    <div className="flex viewport-height flex-col bg-bg-page overflow-hidden">
      <Header />
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="pb-[calc(5rem+env(safe-area-inset-bottom))] px-md">
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

