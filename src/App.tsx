import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import { RoleProtectedRoute } from './components/RoleProtectedRoute'
import { MANAGE_PRODUCTS } from './lib/permissions'

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const SetupPage = lazy(() => import('./pages/SetupPage').then(m => ({ default: m.SetupPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ProductsPage = lazy(() => import('./pages/ProductsPage').then(m => ({ default: m.ProductsPage })))
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })))
const StockLedgerPage = lazy(() => import('./pages/StockLedgerPage').then(m => ({ default: m.StockLedgerPage })))
const CustomersPage = lazy(() => import('./pages/CustomersPage').then(m => ({ default: m.CustomersPage })))
const ReviewerDashboardPage = lazy(() => import('./pages/ReviewerDashboardPage').then(m => ({ default: m.ReviewerDashboardPage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const PendingProductsPage = lazy(() => import('./pages/PendingProductsPage').then(m => ({ default: m.PendingProductsPage })))

/**
 * Redirect internal users away from org routes to /reviewer
 */
function InternalUserRedirect({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()

  // If internal user tries to access org routes, redirect to reviewer
  if (user?.isInternal && location.pathname !== '/reviewer' && !location.pathname.startsWith('/reviewer/')) {
    // Check if they're on an org route (not reviewer route)
    const orgRoutes = ['/', '/products', '/inventory', '/stock-ledger', '/customers', '/notifications', '/pending-products']
    if (orgRoutes.includes(location.pathname)) {
      return <Navigate to="/reviewer" replace />
    }
  }

  return <>{children}</>
}

function AppRoutes() {
  const { user, loading, connectionError, retrying, retryConnection } = useAuth()
  const location = useLocation()

  // Check if we're on the reset password page with recovery params
  const isRecoveryFlow = location.pathname === '/reset-password' && 
    (location.search.includes('type=recovery') || location.hash.includes('type=recovery'))

  // Show loading spinner while loading (max 5 seconds due to timeout)
  // But skip loading check if we're in recovery flow (let ResetPasswordPage handle its own loading)
  if (loading && !isRecoveryFlow) {
    return (
      <div className="viewport-height flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Show connection error if connection failed and we don't have a user (cached or otherwise)
  // Skip this check during recovery flow
  if (connectionError && !retrying && !user && !isRecoveryFlow) {
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
        <InternalUserRedirect>
          <Routes>
            <Route
              path="/login"
              element={user ? (user.isInternal ? <Navigate to="/reviewer" replace /> : <Navigate to="/" replace />) : <LoginPage />}
            />
            <Route
              path="/reset-password"
              element={<ResetPasswordPage />}
            />
            <Route
              path="/setup"
              element={
                user ? <SetupPage /> : <Navigate to="/login" replace />
              }
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
            <Route 
              path="products" 
              element={
                <RoleProtectedRoute requiredPermission={MANAGE_PRODUCTS}>
                  <ProductsPage />
                </RoleProtectedRoute>
              } 
            />
            <Route path="inventory" element={<InventoryPage />} />
            <Route 
              path="stock-ledger" 
              element={
                <RoleProtectedRoute requiredRole={['owner', 'branch_head']}>
                  <StockLedgerPage />
                </RoleProtectedRoute>
              } 
            />
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
        </InternalUserRedirect>
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

