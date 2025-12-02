import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { PullToRefresh } from '../ui/PullToRefresh'
import { RefreshProvider, useRefresh } from '../../contexts/RefreshContext'
import { useServiceWorker } from '../../contexts/ServiceWorkerContext'

function MainLayoutContent() {
  const { refresh, registerServiceWorker } = useRefresh()
  const { registration } = useServiceWorker()
  const location = useLocation()

  // Share SW registration with RefreshContext for pull-to-refresh
  if (registration) {
    registerServiceWorker(registration)
  }

  const handleRefresh = async () => {
    // Call the refresh flow (SW update check + data refresh)
    await refresh()
  }

  // Hide navigation on full-screen detail pages
  const hideNavigation =
    location.pathname.startsWith('/customers/') && location.pathname !== '/customers'

  return (
    <div className="flex viewport-height flex-col bg-bg-page overflow-hidden">
      {!hideNavigation && <Header />}
      <PullToRefresh onRefresh={handleRefresh}>
        <main className={hideNavigation ? '' : 'pb-[calc(5rem+env(safe-area-inset-bottom))] px-md md:px-lg'}>
          {hideNavigation ? (
            <Outlet />
          ) : (
            <div className="container-mobile mx-auto max-w-7xl py-md space-y-lg">
              <Outlet />
            </div>
          )}
        </main>
      </PullToRefresh>
      {!hideNavigation && <BottomNav />}
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
