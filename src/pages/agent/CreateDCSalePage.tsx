import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { AgentPortalLayout } from '../../components/layout/AgentPortalLayout'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useCreateDCSale, type PaymentMethod } from '../../hooks/agent/useCreateDCSale'
import { TrashIcon, PlusIcon, CubeIcon, BanknotesIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export function CreateDCSalePage() {
  const { user, currentAgentContext } = useAuth()
  const navigate = useNavigate()

  // Local UI state
  const [customerInput, setCustomerInput] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [showCashWarning, setShowCashWarning] = useState(false)

  // Business logic hook
  const {
    loading,
    submitting,
    dcStock,
    customer,
    searchingCustomer,
    items,
    paymentMethod,
    cashSettings,
    subtotal,
    setCustomer,
    setPaymentMethod,
    searchCustomer,
    addItem,
    updateItemQuantity,
    updateItemPrice,
    removeItem,
    submitSale
  } = useCreateDCSale()

  const handleCustomerSearch = async () => {
    await searchCustomer(customerInput)
  }

  const handleAddItem = () => {
    addItem(selectedProduct)
    setSelectedProduct('')
  }

  const handleSubmit = async () => {
    const success = await submitSale()
    if (success) {
      navigate('/agent/dashboard')
    }
  }

  if (loading) {
    return (
      <AgentPortalLayout title="Create Sale">
        <div className="flex items-center justify-center py-xl">
          <LoadingSpinner size="lg" />
        </div>
      </AgentPortalLayout>
    )
  }

  // Auth check fallback (though hook handles data loading protection)
  if (!user || !currentAgentContext) {
    return null
  }

  if (dcStock.length === 0) {
    return (
      <AgentPortalLayout title="Create Sale">
        <Card className="shadow-sm max-w-2xl mx-auto">
          <CardContent className="p-xl text-center">
            <CubeIcon className="h-12 w-12 text-text-muted mx-auto mb-md" />
            <p className="text-text-secondary mb-md">
              No DC stock available to sell
            </p>
            <Button onClick={() => navigate('/agent/delivery-challans')} variant="primary">
              View Delivery Challans
            </Button>
          </CardContent>
        </Card>
      </AgentPortalLayout>
    )
  }

  return (
    <AgentPortalLayout title="Create Customer Sale">
      <div className="space-y-md max-w-4xl mx-auto pb-32">
        {/* Customer Selection */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="p-md">
            {!customer ? (
              <div className="flex gap-sm">
                <Input
                  type="text"
                  placeholder="Enter mobile (10 digits) or GSTIN"
                  value={customerInput}
                  onChange={(e) => setCustomerInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCustomerSearch()}
                  className="flex-1"
                />
                <Button
                  onClick={handleCustomerSearch}
                  variant="primary"
                  disabled={!customerInput.trim()}
                  isLoading={searchingCustomer}
                >
                  Search
                </Button>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-text-primary">{customer.master_customer.legal_name}</h3>
                  <p className="text-sm text-text-secondary">{customer.master_customer.mobile || customer.master_customer.gstin}</p>
                </div>
                <Button onClick={() => setCustomer(null)} variant="ghost" size="sm">
                  Change
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Items */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="p-md">
            <div className="flex gap-sm mb-md">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex-1 px-md py-sm border border-border-color rounded-md"
              >
                <option value="">Select product...</option>
                {dcStock.map((stock) => (
                  <option key={stock.product_id} value={stock.product_id}>
                    {stock.product.name} - {stock.product.sku} (Available: {stock.current_stock})
                  </option>
                ))}
              </select>
              <Button onClick={handleAddItem} variant="primary" disabled={!selectedProduct}>
                <PlusIcon className="h-5 w-5" />
              </Button>
            </div>

            {/* Items List */}
            {items.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-md">
                No items added yet
              </p>
            ) : (
              <div className="space-y-sm">
                {items.map((item, index) => (
                  <div key={index} className="border border-border-color rounded-md p-sm">
                    <div className="flex items-start justify-between mb-sm">
                      <div className="flex-1">
                        <h4 className="font-medium text-text-primary text-sm">{item.product_name}</h4>
                        <p className="text-xs text-text-secondary">{item.product_sku}</p>
                        <p className="text-xs text-text-muted">Max: {item.max_quantity} units</p>
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="text-error hover:text-error-dark"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-sm">
                      <div>
                        <label className="text-xs text-text-secondary">Qty</label>
                        <Input
                          type="number"
                          min="1"
                          max={item.max_quantity}
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary">Price</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary">Total</label>
                        <div className="text-sm font-semibold text-text-primary py-sm">
                          ₹{item.line_total.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Selection */}
        {items.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="p-md">
              <div className="space-y-sm">
                {/* Digital Payments (Direct to Seller) */}
                <label className="flex items-start gap-sm p-md border border-border-color rounded-md cursor-pointer hover:bg-bg-hover has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="upi"
                    checked={paymentMethod === 'upi'}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">UPI / QR Code</p>
                    <p className="text-xs text-text-secondary">Payment goes directly to seller's account</p>
                  </div>
                </label>

                <label className="flex items-start gap-sm p-md border border-border-color rounded-md cursor-pointer hover:bg-bg-hover has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="payment_link"
                    checked={paymentMethod === 'payment_link'}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">Payment Link / Gateway</p>
                    <p className="text-xs text-text-secondary">Send payment link to customer</p>
                  </div>
                </label>

                {/* Cash Payment */}
                <label className="flex items-start gap-sm p-md border border-warning rounded-md cursor-pointer hover:bg-warning/5 has-[:checked]:border-warning has-[:checked]:bg-warning/10">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={(e) => {
                      setPaymentMethod(e.target.value as PaymentMethod)
                      setShowCashWarning(true)
                    }}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-xs mb-xs">
                      <BanknotesIcon className="h-4 w-4 text-warning" />
                      <p className="text-sm font-medium text-text-primary">Cash Payment</p>
                    </div>
                    <p className="text-xs text-text-secondary">I physically collected cash from customer</p>
                    {cashSettings && subtotal > cashSettings.section_269st_limit && (
                      <div className="mt-xs p-xs bg-error/10 border border-error rounded">
                        <p className="text-xs text-error font-semibold">
                          ⚠️ Amount exceeds ₹{cashSettings.section_269st_limit.toLocaleString('en-IN')} legal limit
                        </p>
                      </div>
                    )}
                  </div>
                </label>

                {/* Unpaid */}
                <label className="flex items-start gap-sm p-md border border-border-color rounded-md cursor-pointer hover:bg-bg-hover has-[:checked]:border-neutral-400 has-[:checked]:bg-neutral-50">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="unpaid"
                    checked={paymentMethod === 'unpaid'}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">Mark as Unpaid</p>
                    <p className="text-xs text-text-secondary">Customer will pay later</p>
                  </div>
                </label>
              </div>

              {/* Cash Warning */}
              {paymentMethod === 'cash' && showCashWarning && (
                <div className="mt-md p-md bg-warning/10 border border-warning rounded-md">
                  <div className="flex items-start gap-sm">
                    <ExclamationTriangleIcon className="h-5 w-5 text-warning shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-semibold text-text-primary mb-xs">Important Legal Notice:</p>
                      <ul className="text-xs text-text-secondary space-y-xs list-disc pl-md">
                        <li>This cash legally belongs to {currentAgentContext?.senderOrgName}</li>
                        <li>You are custodian only (Indian Contract Act - Agency)</li>
                        <li>Must deposit within {cashSettings?.max_cash_holding_days || 3} days</li>
                        <li>UTR/proof required for verification</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary & Submit */}
        {items.length > 0 && (
          <Card className="shadow-md border-primary">
            <CardContent className="p-md">
              <div className="flex items-center justify-between mb-md">
                <span className="text-lg font-semibold text-text-primary">Subtotal</span>
                <span className="text-2xl font-bold text-primary">₹{subtotal.toFixed(2)}</span>
              </div>
              <Button
                onClick={handleSubmit}
                variant="primary"
                className="w-full"
                disabled={!customer || items.length === 0 || paymentMethod === 'unpaid' || submitting}
                isLoading={submitting}
              >
                {paymentMethod === 'cash' ? 'Create Sale & Record Cash' : 'Create Sale'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AgentPortalLayout>
  )
}
