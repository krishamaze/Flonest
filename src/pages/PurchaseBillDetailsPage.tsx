/**
 * Purchase Bill Details Page
 * 
 * Displays purchase bill details with workflow actions
 * Route: /purchase-bills/:id
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PurchaseBillView } from '../components/purchaseBill/PurchaseBillView'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export function PurchaseBillDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  if (!id) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-error">Invalid purchase bill ID</p>
            <div className="mt-4 text-center">
              <Button onClick={() => navigate('/purchase-bills')}>Back to Purchase Bills</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user?.orgId || !user?.id) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-error">Organization not found</p>
            <div className="mt-4 text-center">
              <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 pb-20">
      <PurchaseBillView
        billId={id}
        orgId={user.orgId}
        userId={user.id}
        onClose={() => navigate('/purchase-bills')}
      />
    </div>
  )
}

