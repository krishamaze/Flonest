import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import type { ApprovalStatus } from '../../types'

interface StatusHelpTextProps {
  status: ApprovalStatus
  className?: string
}

export function StatusHelpText({ status, className = '' }: StatusHelpTextProps) {
  const [isOpen, setIsOpen] = useState(false)

  const getStatusInfo = (status: ApprovalStatus) => {
    switch (status) {
      case 'pending':
        return {
          title: 'Pending Review',
          description: 'This product is waiting for reviewer approval. It cannot be used in invoices until approved.',
          color: 'text-warning',
          bgColor: 'bg-warning-light',
        }
      case 'approved':
        return {
          title: 'Approved',
          description: 'This product has been approved and is available for use in invoices.',
          color: 'text-success',
          bgColor: 'bg-success-light',
        }
      case 'rejected':
        return {
          title: 'Rejected',
          description: 'This product was rejected. Check the rejection reason for details. You may need to resubmit with corrections.',
          color: 'text-error',
          bgColor: 'bg-error-light',
        }
      case 'auto_pass':
        return {
          title: 'Auto-Approved',
          description: 'This product was automatically approved (legacy status). It is available for use.',
          color: 'text-success',
          bgColor: 'bg-success-light',
        }
      default:
        return {
          title: 'Unknown Status',
          description: 'Status information not available.',
          color: 'text-secondary-text',
          bgColor: 'bg-neutral-100',
        }
    }
  }

  const info = getStatusInfo(status)

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-xs text-xs text-muted-text hover:text-primary-text transition-colors"
        aria-label="Status information"
      >
        <InformationCircleIcon className="h-4 w-4" />
        <span>What does this mean?</span>
      </button>

      {isOpen && (
        <div className={`absolute z-10 mt-xs p-md rounded-md shadow-lg border border-neutral-200 ${info.bgColor} min-w-[280px] max-w-[320px]`}>
          <div className="flex items-start justify-between gap-sm mb-xs">
            <h4 className={`text-sm font-semibold ${info.color}`}>{info.title}</h4>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-text hover:text-primary-text"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-secondary-text">{info.description}</p>
        </div>
      )}
    </div>
  )
}

