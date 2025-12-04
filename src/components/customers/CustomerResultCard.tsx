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
    <Card className="border-2 border-primary-light shadow-sm">
      <CardContent className="p-md">
        <div className="space-y-md">
          {/* Customer Name */}
          <div>
            <h3 className="text-base font-semibold text-primary-text">{displayName}</h3>
            {customer.alias_name && master.legal_name && (
              <p className="text-xs text-muted-text mt-xs">Legal: {master.legal_name}</p>
            )}
          </div>

          {/* Identifier */}
          {identifier && (
            <div className="flex items-center gap-sm text-sm">
              <span className="text-secondary-text">
                {identifierType === 'mobile' ? 'Mobile:' : 'GSTIN:'}
              </span>
              <span className="font-medium text-primary-text">{identifier}</span>
            </div>
          )}

          {/* Verified Customer Info */}
          <div className="space-y-xs text-xs text-secondary-text">
            {master.email && (
              <div className="flex items-center gap-sm">
                <span>Email:</span>
                <span className="text-primary-text">{master.email}</span>
              </div>
            )}
            {master.address && (
              <div>
                <span>Address: </span>
                <span className="text-primary-text">{master.address}</span>
              </div>
            )}
            {master.state_code && (
              <div>
                <span>State Code: </span>
                <span className="text-primary-text">{master.state_code}</span>
              </div>
            )}
          </div>

          {/* Org-Specific Info */}
          {(customer.billing_address || customer.shipping_address || customer.notes) && (
            <div className="pt-sm border-t border-neutral-200 space-y-xs text-xs text-secondary-text">
              {customer.billing_address && (
                <div>
                  <span className="font-medium">Billing: </span>
                  <span className="text-primary-text">{customer.billing_address}</span>
                </div>
              )}
              {customer.shipping_address && (
                <div>
                  <span className="font-medium">Shipping: </span>
                  <span className="text-primary-text">{customer.shipping_address}</span>
                </div>
              )}
              {customer.notes && (
                <div>
                  <span className="font-medium">Notes: </span>
                  <span className="text-primary-text">{customer.notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-sm pt-sm">
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

