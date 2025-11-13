import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { PullToRefresh } from '../ui/PullToRefresh'

export function MainLayout() {
  const handleRefresh = async () => {
    // Reload the current page
    await new Promise((resolve) => {
      window.location.reload()
      setTimeout(resolve, 500)
    })
  }

  return (
    <div className="flex viewport-height flex-col bg-bg-page overflow-hidden">
      <Header />
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="pb-20 safe-bottom px-md min-h-screen">
          <div className="container-mobile mx-auto max-w-7xl py-md">
            <Outlet />
          </div>
        </main>
      </PullToRefresh>
      <BottomNav />
    </div>
  )
}

