/**
 * Invoice Details Page
 * 
 * Displays finalized invoice with print/PDF export functionality
 * Route: /invoices/:id
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { InvoiceView } from '../components/invoice/InvoiceView'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export function InvoiceDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  if (!id) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-error">Invalid invoice ID</p>
            <div className="mt-4 text-center">
              <Button onClick={() => navigate('/inventory')}>Back to Invoices</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user?.orgId) {
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
      <InvoiceView
        invoiceId={id}
        orgId={user.orgId}
        userId={user.id}
        onClose={() => navigate('/inventory')}
      />
    </div>
  )
}

