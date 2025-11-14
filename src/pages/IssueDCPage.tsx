import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import { MainLayout } from '../components/layout/MainLayout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { toast } from 'react-toastify'
import { 
  createDeliveryChallan,
  generateDCNumber,
  type DCItemInput
} from '../lib/api/deliveryChallans'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

export function IssueDCPage() {
  const { relationshipId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [agentInfo, setAgentInfo] = useState<any>(null)
  const [dcNumber, setDcNumber] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<(DCItemInput & { product_name?: string })[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [notes, setNotes] = useState('')

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

      // Load agent relationship info
      const { data: rel, error: relError } = await supabase
        .from('agent_relationships')
        .select('*, profiles!agent_relationships_agent_user_id_fkey(id, email, full_name)')
        .eq('id', relationshipId)
        .eq('sender_org_id', user.orgId)
        .single()

      if (relError) throw relError
      setAgentInfo(rel)

      // Generate DC number
      const number = await generateDCNumber(user.orgId)
      setDcNumber(number)

      // Load sender org products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('org_id', user.orgId)
        .eq('status', 'active')
        .order('name')

      if (productsError) throw productsError
      setProducts(productsData || [])
    } catch (error: any) {
      console.error('Error loading data:', error)
      toast.error(error.message || 'Failed to load data')
      navigate('/agents')
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = () => {
    if (!selectedProductId) {
      toast.error('Please select a product')
      return
    }

    const product = products.find(p => p.id === selectedProductId)
    if (!product) return

    if (items.find(i => i.product_id === selectedProductId)) {
      toast.error('Product already added')
      return
    }

    setItems([
      ...items,
      {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.selling_price || 0,
      }
    ])
    setSelectedProductId('')
  }

  const handleUpdateQuantity = (index: number, quantity: number) => {
    const updated = [...items]
    updated[index].quantity = Math.max(1, quantity)
    setItems(updated)
  }

  const handleUpdatePrice = (index: number, price: number) => {
    const updated = [...items]
    updated[index].unit_price = Math.max(0, price)
    setItems(updated)
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!user?.orgId || !agentInfo) return

    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    try {
      setSubmitting(true)
      await createDeliveryChallan(
        user.orgId,
        agentInfo.agent_user_id,
        items,
        dcNumber,
        user.id,
        notes
      )
      toast.success('Delivery challan issued successfully')
      navigate('/agents')
    } catch (error: any) {
      console.error('Error creating DC:', error)
      toast.error(error.message || 'Failed to issue DC')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <MainLayout title="Issue DC">
        <div className="flex items-center justify-center py-xl">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout title="Issue Delivery Challan">
      <div className="space-y-md max-w-4xl mx-auto pb-32">
        {/* Agent Info */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Agent Information</CardTitle>
          </CardHeader>
          <CardContent className="p-md">
            <div>
              <p className="text-sm text-text-secondary">Agent</p>
              <p className="font-medium text-text-primary">
                {(agentInfo as any)?.profiles?.full_name || (agentInfo as any)?.profiles?.email}
              </p>
              <p className="text-xs text-text-muted">{(agentInfo as any)?.profiles?.email}</p>
            </div>
            <div className="mt-sm">
              <p className="text-sm text-text-secondary">DC Number</p>
              <p className="font-mono font-medium text-text-primary">{dcNumber}</p>
            </div>
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
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex-1 px-md py-sm border border-border-color rounded-md"
              >
                <option value="">Select product...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {product.sku}
                  </option>
                ))}
              </select>
              <Button onClick={handleAddItem} variant="primary" disabled={!selectedProductId}>
                <PlusIcon className="h-5 w-5" />
              </Button>
            </div>

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
                      </div>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="text-error hover:text-error-dark"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-sm">
                      <div>
                        <label className="text-xs text-text-secondary">Quantity</label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(index, parseInt(e.target.value) || 1)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary">Unit Price</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price || ''}
                          onChange={(e) => handleUpdatePrice(index, parseFloat(e.target.value) || 0)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="p-md">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for the agent..."
              className="w-full px-md py-sm border border-border-color rounded-md min-h-[80px]"
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-sm">
          <Button onClick={() => navigate('/agents')} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="primary"
            className="flex-1"
            disabled={items.length === 0 || submitting}
            isLoading={submitting}
          >
            Issue DC
          </Button>
        </div>
      </div>
    </MainLayout>
  )
}

