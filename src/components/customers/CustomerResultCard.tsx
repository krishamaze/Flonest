import { CustomerWithMaster } from '../../types'
import { Card, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { detectIdentifierType } from '../../lib/utils/identifierValidation'

interface CustomerResultCardProps {
  customer: CustomerWithMaster
  onSelect: () => void
  onEdit?: () => void
}

export function CustomerResultCard({ customer, onSelect, onEdit }: CustomerResultCardProps) {
  const master = customer.master_customer
  const identifier = master.mobile || master.gstin || ''
  const identifierType = identifier ? detectIdentifierType(identifier) : 'invalid'
  const displayName = customer.alias_name || master.legal_name

  return (
    <Card className="border-2 border-primary-200 shadow-sm">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Customer Name */}
          <div>
            <h3 className="text-base font-semibold text-gray-900">{displayName}</h3>
            {customer.alias_name && master.legal_name && (
              <p className="text-xs text-gray-500 mt-0.5">Legal: {master.legal_name}</p>
            )}
          </div>

          {/* Identifier */}
          {identifier && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">
                {identifierType === 'mobile' ? 'Mobile:' : 'GSTIN:'}
              </span>
              <span className="font-medium text-gray-900">{identifier}</span>
            </div>
          )}

          {/* Master Customer Info */}
          <div className="space-y-1 text-xs text-gray-600">
            {master.email && (
              <div className="flex items-center gap-2">
                <span>Email:</span>
                <span className="text-gray-900">{master.email}</span>
              </div>
            )}
            {master.address && (
              <div>
                <span>Address: </span>
                <span className="text-gray-900">{master.address}</span>
              </div>
            )}
            {master.state_code && (
              <div>
                <span>State Code: </span>
                <span className="text-gray-900">{master.state_code}</span>
              </div>
            )}
          </div>

          {/* Org-Specific Info */}
          {(customer.billing_address || customer.shipping_address || customer.notes) && (
            <div className="pt-2 border-t border-gray-200 space-y-1 text-xs text-gray-600">
              {customer.billing_address && (
                <div>
                  <span className="font-medium">Billing: </span>
                  <span className="text-gray-900">{customer.billing_address}</span>
                </div>
              )}
              {customer.shipping_address && (
                <div>
                  <span className="font-medium">Shipping: </span>
                  <span className="text-gray-900">{customer.shipping_address}</span>
                </div>
              )}
              {customer.notes && (
                <div>
                  <span className="font-medium">Notes: </span>
                  <span className="text-gray-900">{customer.notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="primary" 
              size="sm" 
              onClick={onSelect} 
              className="flex-1 min-h-[44px]"
              aria-label={`Select customer ${displayName}`}
            >
              Use This Customer
            </Button>
            {onEdit && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onEdit}
                className="min-h-[44px]"
                aria-label={`Edit customer ${displayName}`}
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

