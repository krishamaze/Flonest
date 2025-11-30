import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRefresh } from '../contexts/RefreshContext'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from '../hooks/useNotifications'
import type { NotificationType } from '../lib/api/notifications'
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'

export function NotificationsPage() {
  const { user } = useAuth()
  const { registerRefreshHandler, unregisterRefreshHandler } = useRefresh()
  const [filter, setFilter] = useState<'all' | 'unread' | NotificationType>('all')

  // Build filters for React Query
  const filters = useMemo(() => {
    const result: any = {}
    if (filter === 'unread') {
      result.read = false
    } else if (filter !== 'all') {
      result.type = filter
    }
    return result
  }, [filter])

  // React Query hooks
  const { data: notifications = [], isLoading: loading, refetch } = useNotifications(user?.id, filters)
  const { mutate: markAsRead } = useMarkAsRead(user?.id)
  const { mutate: markAllAsRead } = useMarkAllAsRead(user?.id)
  const { mutate: deleteNotification } = useDeleteNotification(user?.id)

  // Register refresh handler for pull-to-refresh
  useEffect(() => {
    registerRefreshHandler(() => refetch())
    return () => unregisterRefreshHandler()
  }, [registerRefreshHandler, unregisterRefreshHandler, refetch])

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead(notificationId, {
      onError: (error) => {
        console.error('Error marking notification as read:', error)
        toast.error('Failed to mark notification as read')
      },
    })
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead(undefined, {
      onSuccess: () => {
        toast.success('All notifications marked as read')
      },
      onError: (error) => {
        console.error('Error marking all as read:', error)
        toast.error('Failed to mark all notifications as read')
      },
    })
  }

  const handleDelete = (notificationId: string) => {
    deleteNotification(notificationId, {
      onSuccess: () => {
        toast.success('Notification deleted')
      },
      onError: (error) => {
        console.error('Error deleting notification:', error)
        toast.error('Failed to delete notification')
      },
    })
  }

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'product_approved':
        return <CheckCircleIcon className="h-5 w-5 text-success" />
      case 'product_rejected':
        return <XCircleIcon className="h-5 w-5 text-error" />
      case 'invoice_blocked':
        return <ExclamationTriangleIcon className="h-5 w-5 text-warning" />
      default:
        return null
    }
  }

  const unreadCount = notifications.filter(n => !n.read_at).length

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-md">
      {/* Header */}
      <div className="flex items-center justify-between px-md">
        <div>
          <h1 className="text-base font-normal text-primary-text">Notifications</h1>
          <p className="mt-xs text-sm text-secondary-text">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={handleMarkAllAsRead} variant="secondary" size="sm">
            Mark All Read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-sm border-b border-neutral-200 overflow-x-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-md py-sm text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            filter === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary-text hover:text-primary-text'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-md py-sm text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            filter === 'unread'
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary-text hover:text-primary-text'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('product_approved')}
          className={`px-md py-sm text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            filter === 'product_approved'
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary-text hover:text-primary-text'
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => setFilter('product_rejected')}
          className={`px-md py-sm text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            filter === 'product_rejected'
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary-text hover:text-primary-text'
          }`}
        >
          Rejected
        </button>
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <Card>
          <CardContent className="p-xl text-center">
            <p className="text-sm text-secondary-text">
              {filter === 'unread' ? 'No unread notifications.' : 'No notifications found.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-sm">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={!notification.read_at ? 'border-primary border-2' : ''}
            >
              <CardContent className="p-md">
                <div className="flex items-start gap-md">
                  <div className="flex-shrink-0 mt-xs">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-sm mb-xs">
                      <h3 className="text-base font-normal text-primary-text">
                        {notification.title}
                      </h3>
                      {!notification.read_at && (
                        <span className="flex-shrink-0 h-2 w-2 rounded-full bg-primary"></span>
                      )}
                    </div>
                    <p className="text-sm text-secondary-text mb-xs">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-text">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                      <div className="flex gap-sm">
                        {!notification.read_at && (
                          <Button
                            onClick={() => handleMarkAsRead(notification.id)}
                            variant="ghost"
                            size="sm"
                          >
                            Mark Read
                          </Button>
                        )}
                        <Button
                          onClick={() => handleDelete(notification.id)}
                          variant="ghost"
                          size="sm"
                          className="text-error hover:text-error-dark"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
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

