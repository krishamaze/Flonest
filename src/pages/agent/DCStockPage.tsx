import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { AgentPortalLayout } from '../../components/layout/AgentPortalLayout'
import { Card, CardContent } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { getDCStock, type DCStockSummary } from '../../lib/api/dcStock'
import { CubeIcon } from '@heroicons/react/24/outline'

export function DCStockPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stock, setStock] = useState<DCStockSummary[]>([])

  useEffect(() => {
    loadStock()
  }, [user?.agentContext])

  const loadStock = async () => {
    if (!user?.agentContext) {
      navigate('/role-selector')
      return
    }

    try {
      setLoading(true)
      const data = await getDCStock(user.agentContext.senderOrgId, user.id)
      setStock(data)
    } catch (error) {
      console.error('Error loading DC stock:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AgentPortalLayout title="DC Stock">
        <div className="flex items-center justify-center py-xl">
          <LoadingSpinner size="lg" />
        </div>
      </AgentPortalLayout>
    )
  }

  return (
    <AgentPortalLayout title="DC Stock">
      <div className="space-y-md max-w-4xl mx-auto">
        {/* Summary */}
        <Card className="shadow-sm bg-primary/10 border-primary">
          <CardContent className="p-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Total Stock Items</p>
                <p className="text-2xl font-bold text-text-primary">{stock.length}</p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Total Units</p>
                <p className="text-2xl font-bold text-text-primary">
                  {stock.reduce((sum, item) => sum + item.current_stock, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stock List */}
        {stock.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-xl text-center">
              <CubeIcon className="h-12 w-12 text-text-muted mx-auto mb-md" />
              <p className="text-text-secondary">
                No DC stock available yet
              </p>
              <p className="text-sm text-text-muted mt-xs">
                Accept delivery challans to receive stock
              </p>
              <Button
                onClick={() => navigate('/agent/delivery-challans')}
                variant="primary"
                className="mt-md"
              >
                View Pending DCs
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-sm">
            {stock.map((item) => (
              <Card key={item.product_id} className="shadow-sm">
                <CardContent className="p-md">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-text-primary">{item.product.name}</h3>
                      <p className="text-sm text-text-secondary">SKU: {item.product.sku}</p>
                      {item.product.category && (
                        <p className="text-xs text-text-muted mt-xs">{item.product.category}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        item.current_stock > 10 ? 'text-success' :
                        item.current_stock > 0 ? 'text-warning' :
                        'text-error'
                      }`}>
                        {item.current_stock}
                      </div>
                      <p className="text-xs text-text-secondary">units</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AgentPortalLayout>
  )
}

