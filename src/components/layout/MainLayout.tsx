import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { PullToRefresh } from '../ui/PullToRefresh'
import { RefreshProvider, useRefresh } from '../../contexts/RefreshContext'

function MainLayoutContent() {
  const { refresh } = useRefresh()

  const handleRefresh = async () => {
    // Call the refresh flow (version check + data refresh)
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

