import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
// MainLayout is handled by routing
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Modal } from '../components/ui/Modal'
import { toast } from 'react-toastify'
import {
  getAllAgentsCashLedger,
  getPendingVerifications,
  verifyCashDeposit,
  rejectCashDeposit,
  type AgentCashLedgerEntry
} from '../lib/api/agentCash'
import {
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { canManageAgents } from '../lib/permissions'

export function AgentCashOversightPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<any[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending')
  const [selectedEntry, setSelectedEntry] = useState<any>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    if (!user || !canManageAgents(user)) {
      navigate('/')
      return
    }
    loadCashData()
  }, [filter, user])

  const loadCashData = async () => {
    if (!user?.orgId) return

    try {
      setLoading(true)
      const [allEntries, pending] = await Promise.all([
        getAllAgentsCashLedger(user.orgId),
        getPendingVerifications(user.orgId)
      ])

      let filtered = allEntries
      if (filter !== 'all') {
        filtered = allEntries.filter(e => e.status === filter)
      }

      setEntries(filtered)
      setPendingCount(pending)
    } catch (error) {
      console.error('Error loading cash data:', error)
      toast.error('Failed to load cash data')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (entryId: string) => {
    if (!user) return
    if (!confirm('Verify this cash deposit?')) return

    try {
      await verifyCashDeposit(entryId, user.id)
      toast.success('Cash deposit verified')
      loadCashData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify deposit')
    }
  }

  const handleReject = (entry: any) => {
    setSelectedEntry(entry)
    setShowRejectModal(true)
  }

  const handleRejectSubmit = async (reason: string) => {
    if (!user || !selectedEntry) return

    try {
      await rejectCashDeposit(selectedEntry.id, reason, user.id)
      toast.success('Cash deposit rejected')
      setShowRejectModal(false)
      setSelectedEntry(null)
      loadCashData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject deposit')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-xl">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="pb-20">
      <div className="space-y-md max-w-4xl mx-auto pb-32">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Cash Oversight</h1>
          {pendingCount > 0 && (
            <div className="flex items-center gap-xs px-md py-sm bg-warning/10 border border-warning rounded-full">
              <ExclamationTriangleIcon className="h-4 w-4 text-warning" />
              <span className="text-sm font-semibold text-warning">
                {pendingCount} pending verification{pendingCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

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
            Pending {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`flex-1 py-sm px-md rounded-md text-sm font-medium transition-all ${
              filter === 'verified'
                ? 'bg-bg-card text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Verified
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

        {/* Entries List */}
        {entries.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-xl text-center">
              <BanknotesIcon className="h-12 w-12 text-text-muted mx-auto mb-md" />
              <p className="text-text-secondary">
                No cash transactions found
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-sm">
            {entries.map((entry) => (
              <Card key={entry.id} className="shadow-sm">
                <CardContent className="p-md">
                  <div className="flex items-start justify-between mb-sm">
                    <div className="flex-1">
                      <div className="flex items-center gap-xs mb-xs">
                        <p className="text-sm font-semibold text-text-primary">
                          {entry.transaction_type.replace('_', ' ').toUpperCase()}
                        </p>
                        {entry.status === 'verified' && (
                          <span className="px-xs py-0.5 bg-success/10 text-success text-xs font-semibold rounded-full flex items-center gap-xs">
                            <CheckCircleIcon className="h-3 w-3" />
                            Verified
                          </span>
                        )}
                        {entry.status === 'pending' && (
                          <span className="px-xs py-0.5 bg-warning/10 text-warning text-xs font-semibold rounded-full flex items-center gap-xs">
                            <ClockIcon className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                        {entry.status === 'rejected' && (
                          <span className="px-xs py-0.5 bg-error/10 text-error text-xs font-semibold rounded-full flex items-center gap-xs">
                            <XCircleIcon className="h-3 w-3" />
                            Rejected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary">
                        Agent: {entry.agent_profile?.full_name || entry.agent_profile?.email}
                      </p>
                      <p className="text-xs text-text-muted">
                        {new Date(entry.created_at).toLocaleString('en-IN')}
                      </p>
                      {entry.invoice && (
                        <p className="text-xs text-text-muted">
                          Invoice: {entry.invoice.invoice_number}
                        </p>
                      )}
                      {entry.reference_number && (
                        <p className="text-xs text-text-muted">
                          Ref: {entry.reference_number}
                        </p>
                      )}
                      {entry.deposited_to && (
                        <p className="text-xs text-text-muted">
                          Deposited to: {entry.deposited_to === 'seller_bank' ? 'Seller Account' : 'Agent Account (pending transfer)'}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-text-secondary mt-xs">
                          Note: {entry.notes}
                        </p>
                      )}
                      {entry.status === 'rejected' && entry.rejection_reason && (
                        <p className="text-xs text-error mt-xs">
                          Rejected: {entry.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${
                        entry.amount > 0 ? 'text-success' : 'text-error'
                      }`}>
                        {entry.amount > 0 ? '+' : ''}₹{Math.abs(entry.amount).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  {/* Actions for pending deposits */}
                  {entry.status === 'pending' && entry.transaction_type !== 'cash_received' && (
                    <div className="flex gap-sm mt-md">
                      <Button
                        onClick={() => handleVerify(entry.id)}
                        variant="primary"
                        size="sm"
                        className="flex-1"
                      >
                        Verify
                      </Button>
                      <Button
                        onClick={() => handleReject(entry)}
                        variant="danger"
                        size="sm"
                        className="flex-1"
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {entry.verified_at && (
                    <p className="text-xs text-text-muted mt-sm">
                      {entry.status === 'verified' ? 'Verified' : 'Rejected'} on {new Date(entry.verified_at).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Reject Modal */}
        <RejectDepositModal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false)
            setSelectedEntry(null)
          }}
          onSubmit={handleRejectSubmit}
          entry={selectedEntry}
        />
      </div>
    </div>
  )
}

// Reject Modal Component
function RejectDepositModal({
  isOpen,
  onClose,
  onSubmit,
  entry
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
  entry: any
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    try {
      setSubmitting(true)
      await onSubmit(reason)
      setReason('')
    } catch (error) {
      // Error handled in parent
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reject Cash Deposit">
      <div className="space-y-md">
        {entry && (
          <div className="p-md bg-bg-selected rounded-md">
            <p className="text-sm text-text-secondary">Rejecting deposit from:</p>
            <p className="font-medium text-text-primary">
              {entry.agent_profile?.full_name || entry.agent_profile?.email}
            </p>
            <p className="text-lg font-bold text-text-primary mt-xs">
              ₹{Math.abs(entry.amount).toLocaleString('en-IN')}
            </p>
            {entry.reference_number && (
              <p className="text-xs text-text-muted mt-xs">
                Ref: {entry.reference_number}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text-primary mb-xs">
            Reason for Rejection *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., UTR mismatch, amount incorrect, invalid proof..."
            className="w-full px-md py-sm border border-border-color rounded-md min-h-[100px]"
          />
        </div>

        <div className="flex gap-sm">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="danger"
            className="flex-1"
            disabled={!reason.trim() || submitting}
            isLoading={submitting}
          >
            Reject Deposit
          </Button>
        </div>
      </div>
    </Modal>
  )
}

