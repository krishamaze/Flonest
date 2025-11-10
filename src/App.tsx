import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { MainLayout } from './components/layout/MainLayout'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { ConnectionError } from './components/ui/ConnectionError'
import { PageTransition } from './components/ui/PageTransition'
import { InstallPrompt } from './components/pwa/InstallPrompt'
import { UpdateNotification } from './components/pwa/UpdateNotification'
import { FRONTEND_VERSION } from './lib/api/version'
import { ProtectedRoute, ReviewerRoute } from './components/ProtectedRoute'

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ProductsPage = lazy(() => import('./pages/ProductsPage').then(m => ({ default: m.ProductsPage })))
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })))
const StockLedgerPage = lazy(() => import('./pages/StockLedgerPage').then(m => ({ default: m.StockLedgerPage })))
const CustomersPage = lazy(() => import('./pages/CustomersPage').then(m => ({ default: m.CustomersPage })))
const ReviewerDashboardPage = lazy(() => import('./pages/ReviewerDashboardPage').then(m => ({ default: m.ReviewerDashboardPage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const PendingProductsPage = lazy(() => import('./pages/PendingProductsPage').then(m => ({ default: m.PendingProductsPage })))

function AppRoutes() {
  const { user, loading, connectionError, retrying, retryConnection } = useAuth()

  // Show loading spinner while loading (max 5 seconds due to timeout)
  if (loading) {
    return (
      <div className="viewport-height flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Show connection error if connection failed and we don't have a user (cached or otherwise)
  // This ensures we always navigate - if user exists, navigation will proceed normally
  if (connectionError && !retrying && !user) {
    return <ConnectionError onRetry={retryConnection} retrying={retrying} />
  }

  return (
    <Suspense
      fallback={
        <div className="viewport-height flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <PageTransition>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <LoginPage />}
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="stock-ledger" element={<StockLedgerPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="pending-products" element={<PendingProductsPage />} />
          </Route>
          <Route
            path="/reviewer"
            element={
              <ReviewerRoute>
                <MainLayout />
              </ReviewerRoute>
            }
          >
            <Route index element={<ReviewerDashboardPage />} />
            <Route path="queue" element={<ReviewerDashboardPage />} />
            <Route path="hsn" element={<ReviewerDashboardPage />} />
            <Route path="blocked-invoices" element={<ReviewerDashboardPage />} />
            <Route path="monitor" element={<ReviewerDashboardPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>
    </Suspense>
  )
}

function App() {
  // Log version on mount for debugging
  useEffect(() => {
    console.log(`FineTune Store v${FRONTEND_VERSION}`)
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <InstallPrompt />
        <UpdateNotification />
        <ToastContainer
          position="top-center"
          autoClose={3000}
          hideProgressBar={false}
          closeOnClick
          pauseOnHover={false}
          draggable={false}
          rtl={false}
          theme="light"
          limit={5}
          newestOnTop={true}
          stacked={true}
          style={{ zIndex: 9999 }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

