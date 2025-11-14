import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
// MainLayout is handled by routing
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { getDCStock, type DCStockSummary } from '../lib/api/dcStock'
import { getDCSalesSummary } from '../lib/api/dcSales'
import { supabase } from '../lib/supabase'
import { toast } from 'react-toastify'
import { CubeIcon, ChartBarIcon } from '@heroicons/react/24/outline'

export function AgentStockReportPage() {
  const { relationshipId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [agentInfo, setAgentInfo] = useState<any>(null)
  const [stock, setStock] = useState<DCStockSummary[]>([])
  const [salesSummary, setSalesSummary] = useState({
    total_sales: 0,
    total_invoices: 0,
    total_items_sold: 0,
  })

  useEffect(() => {
    loadData()
  }, [relationshipId])

  const loadData = async () => {
    if (!user?.orgId || !relationshipId) {
      navigate('/agents')
      return
    }

    try {
      setLoading(true)

      // Load agent relationship
      const { data: rel, error: relError } = await supabase
        .from('agent_relationships')
        .select('*, profiles!agent_relationships_agent_user_id_fkey(id, email, full_name)')
        .eq('id', relationshipId)
        .eq('sender_org_id', user.orgId)
        .single()

      if (relError) throw relError
      setAgentInfo(rel)

      const agentUserId = rel.agent_user_id

      // Load DC stock
      const stockData = await getDCStock(user.orgId, agentUserId)
      setStock(stockData)

      // Load sales summary
      const summary = await getDCSalesSummary(user.orgId, agentUserId)
      setSalesSummary(summary)
    } catch (error: any) {
      console.error('Error loading agent stock report:', error)
      toast.error(error.message || 'Failed to load report')
      navigate('/agents')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-xl">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const totalStock = stock.reduce((sum, item) => sum + item.current_stock, 0)

  return (
    <div className="pb-20">
      <div className="space-y-md max-w-4xl mx-auto pb-32">
        {/* Agent Info */}
        <Card className="shadow-sm bg-primary/10 border-primary">
          <CardContent className="p-md">
            <h2 className="font-semibold text-text-primary mb-xs">
              {(agentInfo as any)?.profiles?.full_name || (agentInfo as any)?.profiles?.email}
            </h2>
            <p className="text-sm text-text-secondary">{(agentInfo as any)?.profiles?.email}</p>
          </CardContent>
        </Card>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 gap-md">
          <Card className="shadow-sm">
            <CardContent className="p-md text-center">
              <CubeIcon className="h-8 w-8 text-primary mx-auto mb-sm" />
              <p className="text-sm text-text-secondary">Current Stock</p>
              <p className="text-3xl font-bold text-text-primary">{totalStock}</p>
              <p className="text-xs text-text-muted">{stock.length} products</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-md text-center">
              <ChartBarIcon className="h-8 w-8 text-success mx-auto mb-sm" />
              <p className="text-sm text-text-secondary">Total Sales</p>
              <p className="text-3xl font-bold text-text-primary">
                ₹{salesSummary.total_sales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-text-muted">{salesSummary.total_invoices} invoices</p>
            </CardContent>
          </Card>
        </div>

        {/* Stock Details */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Stock Details</CardTitle>
          </CardHeader>
          <CardContent className="p-md">
            {stock.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-lg">
                No stock available
              </p>
            ) : (
              <div className="space-y-xs">
                {stock.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex justify-between items-center py-sm border-b border-border-color last:border-0"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">{item.product.name}</p>
                      <p className="text-xs text-text-secondary">{item.product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-text-primary">{item.current_stock}</p>
                      <p className="text-xs text-text-secondary">units</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-sm">
          <Button onClick={() => navigate('/agents')} variant="secondary" className="flex-1">
            Back to Agents
          </Button>
          <Button
            onClick={() => navigate(`/agents/${relationshipId}/issue-dc`)}
            variant="primary"
            className="flex-1"
          >
            Issue New DC
          </Button>
        </div>
      </div>
    </div>
  )
}

