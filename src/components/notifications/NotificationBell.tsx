import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellIcon } from '@heroicons/react/24/outline'
import { getUnreadCount, getNotifications, markAsRead } from '../../lib/api/notifications'
import type { Notification } from '../../lib/api/notifications'
import { useAuth } from '../../contexts/AuthContext'
import { Drawer } from '../ui/Drawer'

export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadUnreadCount()
      // Poll for new notifications every 30 seconds
      const interval = setInterval(loadUnreadCount, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  useEffect(() => {
    if (isOpen && user) {
      loadRecentNotifications()
    }
  }, [isOpen, user])


  const loadUnreadCount = async () => {
    if (!user) return

    try {
      const count = await getUnreadCount(user.id)
      setUnreadCount(count)
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }

  const loadRecentNotifications = async () => {
    if (!user) return

    setLoading(true)
    try {
      const notifications = await getNotifications(user.id, {
        limit: 5,
        read: false,
      })
      setRecentNotifications(notifications)
    } catch (error) {
      console.error('Error loading recent notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read_at) {
      try {
        await markAsRead(notification.id)
        setUnreadCount(Math.max(0, unreadCount - 1))
        setRecentNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)
        )
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    }
    setIsOpen(false)
    navigate('/notifications')
  }

  const handleViewAll = () => {
    setIsOpen(false)
    navigate('/notifications')
  }

  if (!user) return null

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-sm rounded-md hover:bg-neutral-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Notifications"
      >
        <BellIcon className="h-6 w-6 text-secondary-text" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <Drawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Notifications"
        headerAction={
          <button
            onClick={handleViewAll}
            className="text-sm text-primary hover:underline font-normal"
          >
            View All
          </button>
        }
      >
        {loading ? (
          <div className="p-md text-center text-secondary-text text-sm">Loading...</div>
        ) : recentNotifications.length === 0 ? (
          <div className="p-md text-center">
            <p className="text-sm text-secondary-text">
              No new notifications
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {recentNotifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full text-left p-md hover:bg-neutral-50 transition-colors ${
                  !notification.read_at ? 'bg-primary-light/10' : ''
                }`}
              >
                <p className="text-sm font-normal text-primary-text mb-xs">
                  {notification.title}
                </p>
                <p className="text-xs text-secondary-text line-clamp-2">
                  {notification.message}
                </p>
                <p className="text-xs text-muted-text mt-xs">
                  {new Date(notification.created_at).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </Drawer>
    </>
  )
}


