import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { VersionCheckProvider } from './contexts/VersionCheckContext'
import { ServiceWorkerProvider } from './contexts/ServiceWorkerContext'
import { OrgSwitcherProvider } from './components/orgs/OrgSwitcher'
import { MainLayout } from './components/layout/MainLayout'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { ConnectionError } from './components/ui/ConnectionError'
import { PageTransition } from './components/ui/PageTransition'
import { InstallPrompt } from './components/pwa/InstallPrompt'
import { UpdateNotification } from './components/pwa/UpdateNotification'
import { FRONTEND_VERSION } from './lib/api/version'
import { ProtectedRoute, PlatformAdminRoute } from './components/ProtectedRoute'
import { RoleProtectedRoute } from './components/RoleProtectedRoute'
import { MANAGE_PRODUCTS } from './lib/permissions'
import { PlatformAdminSessionWatcher } from './components/security/PlatformAdminSessionWatcher'

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const UnregisteredPage = lazy(() => import('./pages/UnregisteredPage').then(m => ({ default: m.UnregisteredPage })))
const OwnerSignupPage = lazy(() => import('./pages/OwnerSignupPage').then(m => ({ default: m.OwnerSignupPage })))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const SetPasswordPage = lazy(() => import('./pages/SetPasswordPage').then(m => ({ default: m.SetPasswordPage })))
const SetupPage = lazy(() => import('./pages/SetupPage').then(m => ({ default: m.SetupPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ProductsPage = lazy(() => import('./pages/ProductsPage').then(m => ({ default: m.ProductsPage })))
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })))
const StockLedgerPage = lazy(() => import('./pages/StockLedgerPage').then(m => ({ default: m.StockLedgerPage })))
const CustomersPage = lazy(() => import('./pages/CustomersPage').then(m => ({ default: m.CustomersPage })))
const PlatformAdminDashboardPage = lazy(() => import('./pages/PlatformAdminDashboardPage').then(m => ({ default: m.PlatformAdminDashboardPage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const PendingProductsPage = lazy(() => import('./pages/PendingProductsPage').then(m => ({ default: m.PendingProductsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const RoleSelectorPage = lazy(() => import('./pages/RoleSelectorPage').then(m => ({ default: m.RoleSelectorPage })))
const AgentsPage = lazy(() => import('./pages/AgentsPage').then(m => ({ default: m.AgentsPage })))
const IssueDCPage = lazy(() => import('./pages/IssueDCPage').then(m => ({ default: m.IssueDCPage })))
const AgentStockReportPage = lazy(() => import('./pages/AgentStockReportPage').then(m => ({ default: m.AgentStockReportPage })))
const AgentDashboardPage = lazy(() => import('./pages/agent/AgentDashboardPage').then(m => ({ default: m.AgentDashboardPage })))
const DeliveryChallansPage = lazy(() => import('./pages/agent/DeliveryChallansPage').then(m => ({ default: m.DeliveryChallansPage })))
const DCStockPage = lazy(() => import('./pages/agent/DCStockPage').then(m => ({ default: m.DCStockPage })))
const CreateDCSalePage = lazy(() => import('./pages/agent/CreateDCSalePage').then(m => ({ default: m.CreateDCSalePage })))
const AgentCashPage = lazy(() => import('./pages/agent/AgentCashPage').then(m => ({ default: m.AgentCashPage })))
const AgentCashOversightPage = lazy(() => import('./pages/AgentCashOversightPage').then(m => ({ default: m.AgentCashOversightPage })))
const PlatformAdminMfaPage = lazy(() => import('./pages/PlatformAdminMfaPage').then(m => ({ default: m.PlatformAdminMfaPage })))
const JoinOrgPage = lazy(() => import('./pages/JoinOrgPage').then(m => ({ default: m.JoinOrgPage })))

/**
 * Redirect platform admins away from org routes to /platform-admin
 */
function InternalUserRedirect({ children }: { children: React.ReactNode }) {
  const { user, requiresAdminMfa } = useAuth()
  const location = useLocation()

  // CRITICAL: Platform admins MUST have AAL2 (requiresAdminMfa = false) to access any admin routes
  if (user?.platformAdmin) {
    // If MFA is required, redirect to MFA page (unless already there)
    if (requiresAdminMfa && location.pathname !== '/admin-mfa') {
      return <Navigate to="/admin-mfa" replace />
    }
    
    // If MFA is satisfied (requiresAdminMfa = false), allow platform-admin routes
    // But redirect org routes to platform-admin
    if (!requiresAdminMfa) {
      const orgRoutes = ['/', '/products', '/inventory', '/stock-ledger', '/customers', '/notifications', '/pending-products']
      if (orgRoutes.includes(location.pathname)) {
        return <Navigate to="/platform-admin" replace />
      }
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
              element={user ? (user.platformAdmin ? <Navigate to="/platform-admin" replace /> : <Navigate to="/" replace />) : <LoginPage />}
            />
            <Route
              path="/owner-signup"
              element={
                user
                  ? user.platformAdmin
                    ? <Navigate to="/platform-admin" replace />
                    : user.orgId
                      ? <Navigate to="/" replace />
                      : <OwnerSignupPage />
                  : <OwnerSignupPage />
              }
            />
            <Route
              path="/unregistered"
              element={<UnregisteredPage />}
            />
          <Route
            path="/admin-mfa"
            element={
              <ProtectedRoute>
                <PlatformAdminMfaPage />
              </ProtectedRoute>
            }
          />
            <Route
              path="/reset-password"
              element={<ResetPasswordPage />}
            />
            <Route
              path="/set-password"
              element={
                user ? <SetPasswordPage /> : <Navigate to="/login" replace />
              }
            />
            <Route
              path="/join-org"
              element={
                <ProtectedRoute>
                  <JoinOrgPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/setup"
              element={
                <ProtectedRoute>
                  <SetupPage />
                </ProtectedRoute>
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
                <RoleProtectedRoute requiredRole={['org_owner', 'branch_head']}>
                  <StockLedgerPage />
                </RoleProtectedRoute>
              } 
            />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="pending-products" element={<PendingProductsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            
            {/* Agent Management Routes (Business context - Admin only) */}
            <Route 
              path="agents" 
              element={
                <RoleProtectedRoute requiredRole="org_owner">
                  <AgentsPage />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="agents/:relationshipId/issue-dc" 
              element={
                <RoleProtectedRoute requiredRole="org_owner">
                  <IssueDCPage />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="agents/:relationshipId/report" 
              element={
                <RoleProtectedRoute requiredRole="org_owner">
                  <AgentStockReportPage />
                </RoleProtectedRoute>
              } 
            />
          </Route>

          {/* Role Selector - shown after login to pick context */}
          <Route
            path="/role-selector"
            element={
              <ProtectedRoute>
                <RoleSelectorPage />
              </ProtectedRoute>
            }
          />

          {/* Agent Portal Routes (Agent context) */}
          <Route
            path="/agent"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/agent/dashboard" replace />} />
            <Route path="dashboard" element={<AgentDashboardPage />} />
            <Route path="delivery-challans" element={<DeliveryChallansPage />} />
            <Route path="stock" element={<DCStockPage />} />
            <Route path="create-sale" element={<CreateDCSalePage />} />
            <Route path="cash" element={<AgentCashPage />} />
          </Route>

          {/* Cash Oversight (Sender Admin) */}
          <Route
            path="/agent-cash-oversight"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute requiredRole="org_owner">
                  <MainLayout />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<AgentCashOversightPage />} />
          </Route>

          {/* Platform Admin Routes */}
          <Route
            path="/platform-admin"
            element={
              <PlatformAdminRoute>
                <MainLayout />
              </PlatformAdminRoute>
            }
          >
            <Route index element={<PlatformAdminDashboardPage />} />
            <Route path="queue" element={<PlatformAdminDashboardPage />} />
            <Route path="gst-verification" element={<PlatformAdminDashboardPage />} />
            <Route path="hsn" element={<PlatformAdminDashboardPage />} />
            <Route path="blocked-invoices" element={<PlatformAdminDashboardPage />} />
            <Route path="monitor" element={<PlatformAdminDashboardPage />} />
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
    console.log(`FineTune Store v${FRONTEND_VERSION} [Service Worker Auto-Update]`)
  }, [])

  return (
    <VersionCheckProvider>
      <ServiceWorkerProvider>
        <AuthProvider>
          <OrgSwitcherProvider>
            <BrowserRouter>
              <AppRoutes />
              <PlatformAdminSessionWatcher />
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
          </OrgSwitcherProvider>
        </AuthProvider>
      </ServiceWorkerProvider>
    </VersionCheckProvider>
  )
}

export default App

