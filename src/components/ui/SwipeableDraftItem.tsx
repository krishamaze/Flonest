import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { useRef } from 'react'
import { Card, CardContent } from './Card'
import type { Invoice } from '../../types'
import { formatRelativeTime } from '../../lib/utils/dateFormatter'

interface SwipeableDraftItemProps {
  invoice: Invoice & { customer?: any }
  onDelete: (invoiceId: string) => void
  onClick?: () => void
  getStatusColor: (status: string | null) => string
  formatDate?: (date: string | Date | null) => string
}

export function SwipeableDraftItem({
  invoice,
  onDelete,
  onClick,
  getStatusColor,
}: SwipeableDraftItemProps) {
  const x = useMotionValue(0)
  const deleteOpacity = useTransform(x, [-100, 0], [1, 0])
  const hasDragged = useRef(false)
  
  // Use relative time for drafts
  const timeDisplay = formatRelativeTime(invoice.updated_at || invoice.created_at)
  const customerName = invoice.customer?.alias_name || invoice.customer?.master_customer?.legal_name || 'No customer selected'

  const handleDragStart = () => {
    hasDragged.current = false
  }

  const handleDrag = () => {
    if (Math.abs(x.get()) > 5) {
      hasDragged.current = true
    }
  }

  const handleDragEnd = (_event: any, info: PanInfo) => {
    if (info.offset.x < -80) {
      // Swipe threshold reached - trigger delete
      onDelete(invoice.id)
      hasDragged.current = true
    } else {
      // Snap back with spring animation
      x.set(0)
      // Reset drag flag after animation
      setTimeout(() => {
        hasDragged.current = false
      }, 200)
    }
  }

  const handleCardClick = () => {
    // Prevent click if we just dragged
    if (!hasDragged.current) {
      onClick?.()
    }
  }

  return (
    <div className="relative overflow-hidden" style={{ position: 'relative' }}>
      {/* Delete action background (revealed on swipe) */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-4 bg-error rounded-lg my-1"
        style={{
          opacity: deleteOpacity,
          zIndex: 0,
        }}
      >
        <span className="text-white font-semibold text-sm">🗑️ Delete</span>
      </motion.div>

      {/* Swipeable card content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.2}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{
          x,
          willChange: 'transform', // Hint browser for GPU acceleration
          position: 'relative',
          zIndex: 1,
        }}
        initial={false} // Skip initial animation on mount
        whileTap={{ scale: 0.98 }} // Subtle press feedback
      >
        <Card
          className={`border shadow-sm ${getStatusColor(invoice.status)} cursor-pointer hover:shadow-md transition-shadow`}
          onClick={handleCardClick}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-xs mb-1">
                  <h3 className="text-base font-medium text-primary-text truncate">
                    {customerName}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-text">
                  <span className="font-mono">{invoice.invoice_number}</span>
                  <span>•</span>
                  <span>{timeDisplay}</span>
                </div>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full whitespace-nowrap">
                  Continue Draft →
                </span>
                <p className="text-sm font-semibold text-primary-text">
                  ₹{((invoice.total_amount ?? 0) as number).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

