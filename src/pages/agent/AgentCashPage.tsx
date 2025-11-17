import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { AgentPortalLayout } from '../../components/layout/AgentPortalLayout'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Modal } from '../../components/ui/Modal'
import { toast } from 'react-toastify'
import {
  getAgentCashOnHand,
  getAgentCashLedger,
  getPendingDeposits,
  recordCashDeposit,
  getCashSettings,
  hasOverdueCash,
  type AgentCashLedgerEntry,
  type CashDepositInput,
  type OrgCashSettings
} from '../../lib/api/agentCash'
import {
  BanknotesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

export function AgentCashPage() {
  const { user, currentAgentContext } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [cashOnHand, setCashOnHand] = useState(0)
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([])
  const [pendingDeposits, setPendingDeposits] = useState<AgentCashLedgerEntry[]>([])
  const [settings, setSettings] = useState<OrgCashSettings | null>(null)
  const [isOverdue, setIsOverdue] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)

  useEffect(() => {
    if (!user || !currentAgentContext) return
    loadCashData()
  }, [user?.id, currentAgentContext?.relationshipId])

  const loadCashData = async () => {
    if (!user || !currentAgentContext) {
      navigate('/')
      return
    }
    try {
      setLoading(true)

      const [balance, entries, pending, cashSettings, overdue] = await Promise.all([
        getAgentCashOnHand(currentAgentContext.senderOrgId, user.id),
        getAgentCashLedger(currentAgentContext.senderOrgId, user.id),
        getPendingDeposits(currentAgentContext.senderOrgId, user.id),
        getCashSettings(currentAgentContext.senderOrgId),
        hasOverdueCash(currentAgentContext.senderOrgId, user.id),
      ])

      setCashOnHand(balance)
      setLedgerEntries(entries)
      setPendingDeposits(pending)
      setSettings(cashSettings)
      setIsOverdue(overdue)
    } catch (error) {
      console.error('Error loading cash data:', error)
      toast.error('Failed to load cash data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AgentPortalLayout title="Cash Management">
        <div className="flex items-center justify-center py-xl">
          <LoadingSpinner size="lg" />
        </div>
      </AgentPortalLayout>
    )
  }

  const pendingAmount = pendingDeposits.reduce((sum, d) => sum + Math.abs(d.amount), 0)

  return (
    <AgentPortalLayout title="Cash Management">
      <div className="space-y-md max-w-4xl mx-auto">
        {/* Overdue Warning */}
        {isOverdue && (
          <Card className="shadow-sm bg-error/10 border-error">
            <CardContent className="p-md">
              <div className="flex items-center gap-md">
                <ExclamationTriangleIcon className="h-6 w-6 text-error shrink-0" />
                <div>
                  <p className="font-semibold text-error">Overdue Cash Detected</p>
                  <p className="text-sm text-text-secondary">
                    You have cash holdings exceeding {settings?.max_cash_holding_days} days. Please deposit immediately.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cash Summary */}
        <div className="grid grid-cols-2 gap-md">
          <Card className={`shadow-sm ${cashOnHand > 0 ? 'border-warning' : 'border-success'}`}>
            <CardContent className="p-md text-center">
              <BanknotesIcon className="h-8 w-8 text-warning mx-auto mb-sm" />
              <p className="text-sm text-text-secondary">Cash On Hand</p>
              <p className="text-3xl font-bold text-text-primary">
                ₹{cashOnHand.toLocaleString('en-IN')}
              </p>
              {settings && cashOnHand > 0 && (
                <p className="text-xs text-text-muted mt-xs">
                  Limit: ₹{settings.max_cash_balance.toLocaleString('en-IN')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-neutral-200">
            <CardContent className="p-md text-center">
              <ClockIcon className="h-8 w-8 text-secondary mx-auto mb-sm" />
              <p className="text-sm text-text-secondary">Pending Verification</p>
              <p className="text-3xl font-bold text-text-primary">
                ₹{pendingAmount.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-text-muted mt-xs">
                {pendingDeposits.length} deposit{pendingDeposits.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Deposit Button */}
        {cashOnHand > 0 && (
          <Button
            onClick={() => setShowDepositModal(true)}
            variant="primary"
            className="w-full"
          >
            Deposit Cash
          </Button>
        )}

        {/* Legal Notice */}
        {settings && (
          <Card className="shadow-sm bg-neutral-50">
            <CardContent className="p-md">
              <p className="text-xs font-semibold text-text-primary mb-xs">Legal Compliance Notice:</p>
              <ul className="text-xs text-text-secondary space-y-xs list-disc pl-md">
                <li>Cash limit per transaction: ₹{settings.section_269st_limit.toLocaleString('en-IN')} (Section 269ST)</li>
                <li>Maximum holding period: {settings.max_cash_holding_days} days</li>
                <li>Maximum cash balance: ₹{settings.max_cash_balance.toLocaleString('en-IN')}</li>
                <li>All cash legally belongs to {currentAgentContext?.senderOrgName}</li>
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Cash Ledger */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Cash Ledger</CardTitle>
          </CardHeader>
          <CardContent className="p-md">
            {ledgerEntries.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-md">
                No cash transactions yet
              </p>
            ) : (
              <div className="space-y-xs">
                {ledgerEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between py-sm border-b border-border-color last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-xs">
                        <p className="text-sm font-medium text-text-primary">
                          {entry.transaction_type.replace('_', ' ').toUpperCase()}
                        </p>
                        {entry.status === 'verified' && (
                          <CheckCircleIcon className="h-4 w-4 text-success" />
                        )}
                        {entry.status === 'pending' && (
                          <ClockIcon className="h-4 w-4 text-warning" />
                        )}
                        {entry.status === 'rejected' && (
                          <XCircleIcon className="h-4 w-4 text-error" />
                        )}
                      </div>
                      <p className="text-xs text-text-secondary">
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
                      {entry.status === 'rejected' && entry.rejection_reason && (
                        <p className="text-xs text-error mt-xs">
                          Rejected: {entry.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        entry.amount > 0 ? 'text-success' : 'text-error'
                      }`}>
                        {entry.amount > 0 ? '+' : ''}₹{Math.abs(entry.amount).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deposit Modal */}
        <CashDepositModal
          isOpen={showDepositModal}
          onClose={() => setShowDepositModal(false)}
          onSuccess={() => {
            setShowDepositModal(false)
            loadCashData()
          }}
          senderOrgId={currentAgentContext?.senderOrgId || ''}
          agentUserId={user?.id || ''}
          currentBalance={cashOnHand}
          settings={settings}
        />
      </div>
    </AgentPortalLayout>
  )
}

// Cash Deposit Modal
function CashDepositModal({
  isOpen,
  onClose,
  onSuccess,
  senderOrgId,
  agentUserId,
  currentBalance,
  settings
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  senderOrgId: string
  agentUserId: string
  currentBalance: number
  settings: OrgCashSettings | null
}) {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [depositedTo, setDepositedTo] = useState<'seller_bank' | 'agent_bank'>('seller_bank')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (amountNum > currentBalance) {
      toast.error(`Amount exceeds cash on hand (₹${currentBalance.toLocaleString('en-IN')})`)
      return
    }

    if (!referenceNumber.trim()) {
      toast.error('Reference number (UTR/Slip) is required')
      return
    }

    try {
      setSubmitting(true)

      const depositData: CashDepositInput = {
        amount: amountNum,
        deposited_to: depositedTo,
        reference_number: referenceNumber.trim(),
        notes: notes.trim() || undefined,
      }

      await recordCashDeposit(senderOrgId, agentUserId, depositData, user?.id || '')
      
      toast.success('Deposit recorded. Awaiting verification from seller.')
      onSuccess()
    } catch (error: any) {
      console.error('Error recording deposit:', error)
      toast.error(error.message || 'Failed to record deposit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deposit Cash">
      <div className="space-y-md">
        {/* Available Balance */}
        <div className="p-md bg-bg-selected rounded-md">
          <p className="text-sm text-text-secondary">Available to Deposit</p>
          <p className="text-2xl font-bold text-text-primary">
            ₹{currentBalance.toLocaleString('en-IN')}
          </p>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-xs">
            Deposit Amount *
          </label>
          <Input
            type="number"
            min="0"
            max={currentBalance}
            step="0.01"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* Deposit Method */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-xs">
            Deposited To *
          </label>
          <div className="space-y-sm">
            <label className="flex items-center gap-sm p-md border border-border-color rounded-md cursor-pointer hover:bg-bg-hover">
              <input
                type="radio"
                name="depositedTo"
                value="seller_bank"
                checked={depositedTo === 'seller_bank'}
                onChange={(e) => setDepositedTo(e.target.value as 'seller_bank')}
                className="w-4 h-4"
              />
              <div>
                <p className="text-sm font-medium text-text-primary">Seller Bank Account</p>
                <p className="text-xs text-text-secondary">Direct deposit to seller's account</p>
              </div>
            </label>
            <label className="flex items-center gap-sm p-md border border-border-color rounded-md cursor-pointer hover:bg-bg-hover">
              <input
                type="radio"
                name="depositedTo"
                value="agent_bank"
                checked={depositedTo === 'agent_bank'}
                onChange={(e) => setDepositedTo(e.target.value as 'agent_bank')}
                className="w-4 h-4"
              />
              <div>
                <p className="text-sm font-medium text-text-primary">My Bank Account</p>
                <p className="text-xs text-text-secondary">I'll transfer to seller electronically</p>
              </div>
            </label>
          </div>
        </div>

        {/* Reference Number */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-xs">
            UTR / Deposit Slip Number *
          </label>
          <Input
            type="text"
            placeholder="Enter reference number"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />
          <p className="text-xs text-text-muted mt-xs">
            {depositedTo === 'seller_bank' ? 'Deposit slip number or bank reference' : 'UPI transaction ID or NEFT/RTGS reference'}
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-xs">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes..."
            className="w-full px-md py-sm border border-border-color rounded-md min-h-[60px]"
          />
        </div>

        {/* Legal Notice */}
        <div className="p-sm bg-warning/10 border border-warning rounded-md">
          <p className="text-xs text-text-secondary">
            ⚖️ Legal Notice: This cash belongs to the seller. Submit deposit proof for verification.
            {settings?.require_deposit_proof && ' Proof attachment is mandatory.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-sm">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="primary"
            className="flex-1"
            disabled={!amount || !referenceNumber.trim() || submitting}
            isLoading={submitting}
          >
            Submit Deposit
          </Button>
        </div>
      </div>
    </Modal>
  )
}

