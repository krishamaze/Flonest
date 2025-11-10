import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent } from '../components/ui/Card'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../lib/api/notifications'
import type { Notification, NotificationType } from '../lib/api/notifications'
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

export function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | NotificationType>('all')

  useEffect(() => {
    if (user) {
      loadNotifications()
    }
  }, [user, filter])

  const loadNotifications = async () => {
    if (!user) return

    setLoading(true)
    try {
      const filters: any = {}
      if (filter === 'unread') {
        filters.read = false
      } else if (filter !== 'all') {
        filters.type = filter
      }

      const data = await getNotifications(user.id, filters)
      setNotifications(data)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId)
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!user) return

    try {
      await markAllAsRead(user.id)
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      )
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary-text">Notifications</h1>
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
            <p className="text-secondary-text">
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
                      <h3 className="text-base font-semibold text-primary-text">
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

