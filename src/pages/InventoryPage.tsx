import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { InventoryTransaction } from '../types'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import {
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'

interface TransactionWithProduct extends InventoryTransaction {
  product_name?: string
}

export function InventoryPage() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<TransactionWithProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTransactions()
  }, [user])

  const loadTransactions = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          products (name)
        `)
        .eq('tenant_id', user.tenantId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const transactionsWithProducts = (data || []).map((t: any) => ({
        ...t,
        product_name: t.products?.name,
      }))

      setTransactions(transactionsWithProducts)
    } catch (error) {
      console.error('Error loading transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <ArrowUpIcon className="h-5 w-5 text-green-600" />
      case 'out':
        return <ArrowDownIcon className="h-5 w-5 text-red-600" />
      case 'adjustment':
        return <AdjustmentsHorizontalIcon className="h-5 w-5 text-blue-600" />
      default:
        return null
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'in':
        return 'bg-green-50 border-green-200'
      case 'out':
        return 'bg-red-50 border-red-200'
      case 'adjustment':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <Button variant="primary" size="sm" className="flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          <span className="hidden sm:inline">New Transaction</span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <ArrowUpIcon className="mx-auto h-8 w-8 text-green-600 mb-2" />
            <p className="text-sm text-gray-600">Stock In</p>
            <p className="text-2xl font-bold text-gray-900">
              {transactions.filter((t) => t.type === 'in').length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-center">
            <ArrowDownIcon className="mx-auto h-8 w-8 text-red-600 mb-2" />
            <p className="text-sm text-gray-600">Stock Out</p>
            <p className="text-2xl font-bold text-gray-900">
              {transactions.filter((t) => t.type === 'out').length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <AdjustmentsHorizontalIcon className="mx-auto h-8 w-8 text-blue-600 mb-2" />
            <p className="text-sm text-gray-600">Adjustments</p>
            <p className="text-2xl font-bold text-gray-900">
              {transactions.filter((t) => t.type === 'adjustment').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">
              No transactions yet. Start tracking your inventory movements.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <Card
              key={transaction.id}
              className={`border ${getTransactionColor(transaction.type)}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                    {getTransactionIcon(transaction.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {transaction.product_name || 'Unknown Product'}
                        </h3>
                        <p className="text-sm text-gray-600 capitalize">
                          {transaction.type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {transaction.type === 'out' ? '-' : '+'}
                          {transaction.quantity}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(transaction.created_at)}
                        </p>
                      </div>
                    </div>
                    {transaction.notes && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                        {transaction.notes}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

