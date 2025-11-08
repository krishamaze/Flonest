import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'

export function MainLayout() {
  return (
    <div className="flex viewport-height flex-col bg-bg-page overflow-hidden">
      <Header />
      <main className="flex-1 pb-20 safe-bottom px-md overflow-y-auto min-h-0">
        <div className="container-mobile mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

