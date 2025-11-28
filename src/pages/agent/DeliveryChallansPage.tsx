import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { AgentPortalLayout } from '../../components/layout/AgentPortalLayout'
import { Card, CardContent } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { toast } from 'react-toastify'
import { 
  getDeliveryChallansForAgent,
  acceptDeliveryChallan,
  rejectDeliveryChallan,
  type DeliveryChallanWithDetails
} from '../../lib/api/deliveryChallans'
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

export function DeliveryChallansPage() {
  const { user, currentAgentContext } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [dcs, setDcs] = useState<DeliveryChallanWithDetails[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !currentAgentContext) return
    loadDCs()
  }, [filter, user?.id, currentAgentContext?.relationshipId])

  const loadDCs = async () => {
    if (!user || !currentAgentContext) {
      navigate('/')
      return
    }
    try {
      setLoading(true)
      const status = filter === 'all' ? undefined : filter
      const data = await getDeliveryChallansForAgent(user.id, currentAgentContext.senderOrgId, status)
      setDcs(data)
    } catch (error) {
      console.error('Error loading DCs:', error)
      toast.error('Failed to load delivery challans')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (dcId: string) => {
    if (!user) return

    try {
      setProcessingId(dcId)
      await acceptDeliveryChallan(dcId, user.id, user.id)
      toast.success('DC accepted successfully')
      loadDCs()
    } catch (error: any) {
      console.error('Error accepting DC:', error)
      toast.error(error.message || 'Failed to accept DC')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (dcId: string) => {
    if (!user) return

    const reason = prompt('Reason for rejection:')
    if (!reason) return

    try {
      setProcessingId(dcId)
      await rejectDeliveryChallan(dcId, user.id, reason)
      toast.success('DC rejected')
      loadDCs()
    } catch (error: any) {
      console.error('Error rejecting DC:', error)
      toast.error(error.message || 'Failed to reject DC')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return (
      <AgentPortalLayout title="Delivery Challans">
        <div className="flex items-center justify-center py-xl">
          <LoadingSpinner size="lg" />
        </div>
      </AgentPortalLayout>
    )
  }

  return (
    <AgentPortalLayout title="Delivery Challans">
      <div className="space-y-md max-w-4xl mx-auto">
        {/* Filter Tabs */}
        <div className="flex gap-sm bg-neutral-100 p-1 rounded-lg">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-sm px-md rounded-md text-sm font-medium transition-all ${
              filter === 'all'
                ? 'bg-bg-card text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`flex-1 py-sm px-md rounded-md text-sm font-medium transition-all ${
              filter === 'pending'
                ? 'bg-bg-card text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('accepted')}
            className={`flex-1 py-sm px-md rounded-md text-sm font-medium transition-all ${
              filter === 'accepted'
                ? 'bg-bg-card text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Accepted
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`flex-1 py-sm px-md rounded-md text-sm font-medium transition-all ${
              filter === 'rejected'
                ? 'bg-bg-card text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Rejected
          </button>
        </div>

        {/* DCs List */}
        {dcs.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-xl text-center">
              <DocumentTextIcon className="h-12 w-12 text-text-muted mx-auto mb-md" />
              <p className="text-text-secondary">
                No delivery challans found
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-md">
            {dcs.map((dc) => (
              <Card key={dc.id} className="shadow-sm">
                <CardContent className="p-md">
                  <div className="flex items-start justify-between mb-md">
                    <div>
                      <h3 className="font-semibold text-text-primary">{dc.dc_number}</h3>
                      <p className="text-sm text-text-secondary">
                        Issued: {new Date(dc.issued_date!).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-xs">
                      {dc.status === 'pending' && (
                        <span className="px-sm py-xs bg-warning/10 text-warning text-xs font-semibold rounded-full flex items-center gap-xs">
                          <ClockIcon className="h-3 w-3" />
                          Pending
                        </span>
                      )}
                      {dc.status === 'accepted' && (
                        <span className="px-sm py-xs bg-success/10 text-success text-xs font-semibold rounded-full flex items-center gap-xs">
                          <CheckCircleIcon className="h-3 w-3" />
                          Accepted
                        </span>
                      )}
                      {dc.status === 'rejected' && (
                        <span className="px-sm py-xs bg-error/10 text-error text-xs font-semibold rounded-full flex items-center gap-xs">
                          <XCircleIcon className="h-3 w-3" />
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-xs mb-md">
                    <p className="text-sm font-medium text-text-secondary">Items:</p>
                    {dc.dc_items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm py-xs border-b border-border-color last:border-0">
                        <span className="text-text-primary">{item.product.name}</span>
                        <span className="text-text-secondary">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {dc.notes && (
                    <p className="text-sm text-text-secondary mb-md">
                      Note: {dc.notes}
                    </p>
                  )}

                  {/* Actions */}
                  {dc.status === 'pending' && (
                    <div className="flex gap-sm">
                      <Button
                        onClick={() => handleAccept(dc.id)}
                        variant="primary"
                        className="flex-1"
                        disabled={processingId === dc.id}
                        isLoading={processingId === dc.id}
                      >
                        Accept
                      </Button>
                      <Button
                        onClick={() => handleReject(dc.id)}
                        variant="danger"
                        className="flex-1"
                        disabled={processingId === dc.id}
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {dc.status === 'accepted' && dc.accepted_date && (
                    <p className="text-xs text-success">
                      Accepted on {new Date(dc.accepted_date).toLocaleDateString()}
                    </p>
                  )}

                  {dc.status === 'rejected' && (
                    <div className="text-xs text-error">
                      <p>Rejected on {dc.rejected_date ? new Date(dc.rejected_date).toLocaleDateString() : 'N/A'}</p>
                      {dc.rejection_reason && <p>Reason: {dc.rejection_reason}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AgentPortalLayout>
  )
}


