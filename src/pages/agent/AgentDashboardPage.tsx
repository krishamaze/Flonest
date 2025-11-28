import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { AgentPortalLayout } from '../../components/layout/AgentPortalLayout'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { getDeliveryChallansForAgent } from '../../lib/api/deliveryChallans'
import { getDCStock } from '../../lib/api/dcStock'
import { getDCSalesSummary } from '../../lib/api/dcSales'
import { 
  DocumentTextIcon, 
  CubeIcon, 
  CurrencyDollarIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

export function AgentDashboardPage() {
  const { user, currentAgentContext } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [pendingDCsCount, setPendingDCsCount] = useState(0)
  const [dcStockCount, setDCStockCount] = useState(0)
  const [salesSummary, setSalesSummary] = useState({
    total_sales: 0,
    total_invoices: 0,
    total_items_sold: 0,
  })

  useEffect(() => {
    if (!user || !currentAgentContext) return
    loadDashboardData()
  }, [user?.id, currentAgentContext?.relationshipId])

  const loadDashboardData = async () => {
    if (!user || !currentAgentContext) {
      navigate('/')
      return
    }
    try {
      setLoading(true)

      // Load pending DCs
      const pendingDCs = await getDeliveryChallansForAgent(
        user.id,
        currentAgentContext.senderOrgId,
        'pending'
      )
      setPendingDCsCount(pendingDCs.length)

      // Load DC stock
      const dcStock = await getDCStock(currentAgentContext.senderOrgId, user.id)
      const totalStock = dcStock.reduce((sum, item) => sum + item.current_stock, 0)
      setDCStockCount(totalStock)

      // Load sales summary (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const summary = await getDCSalesSummary(
        currentAgentContext.senderOrgId,
        user.id,
        thirtyDaysAgo
      )
      setSalesSummary(summary)
    } catch (error) {
      console.error('Error loading agent dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AgentPortalLayout title="Agent Dashboard">
        <div className="flex items-center justify-center py-xl">
          <LoadingSpinner size="lg" />
        </div>
      </AgentPortalLayout>
    )
  }

  return (
    <AgentPortalLayout title="Agent Dashboard">
      <div className="space-y-md max-w-4xl mx-auto">
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-md">
          <Card className="shadow-sm">
            <CardContent className="p-md">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 bg-warning/10 rounded-md flex items-center justify-center">
                  <DocumentTextIcon className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Pending DCs</p>
                  <p className="text-2xl font-bold text-text-primary">{pendingDCsCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-md">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center">
                  <CubeIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">DC Stock</p>
                  <p className="text-2xl font-bold text-text-primary">{dcStockCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-md">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 bg-success/10 rounded-md flex items-center justify-center">
                  <CurrencyDollarIcon className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Sales (30d)</p>
                  <p className="text-2xl font-bold text-text-primary">
                    ₹{salesSummary.total_sales.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-md">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 bg-secondary/10 rounded-md flex items-center justify-center">
                  <ChartBarIcon className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Invoices</p>
                  <p className="text-2xl font-bold text-text-primary">{salesSummary.total_invoices}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-md">
            <div className="grid grid-cols-2 gap-md">
              <button
                onClick={() => navigate('/agent/delivery-challans')}
                className="flex flex-col items-center gap-sm p-md rounded-lg border border-border-color hover:bg-bg-hover hover:border-primary transition-all"
              >
                <DocumentTextIcon className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-text-primary">View DCs</span>
                {pendingDCsCount > 0 && (
                  <span className="px-2 py-1 bg-warning text-white text-xs font-bold rounded-full">
                    {pendingDCsCount} pending
                  </span>
                )}
              </button>

              <button
                onClick={() => navigate('/agent/stock')}
                className="flex flex-col items-center gap-sm p-md rounded-lg border border-border-color hover:bg-bg-hover hover:border-primary transition-all"
              >
                <CubeIcon className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-text-primary">View Stock</span>
              </button>

              <button
                onClick={() => navigate('/agent/create-sale')}
                className="flex flex-col items-center gap-sm p-md rounded-lg border border-border-color hover:bg-bg-hover hover:border-primary transition-all col-span-2"
              >
                <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium text-text-primary">Create Customer Sale</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Placeholder */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-md">
            <p className="text-sm text-text-secondary text-center py-lg">
              No recent activity to display
            </p>
          </CardContent>
        </Card>
      </div>
    </AgentPortalLayout>
  )
}


