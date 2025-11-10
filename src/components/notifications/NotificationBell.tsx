import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { BellIcon } from '@heroicons/react/24/outline'
import { getUnreadCount, getNotifications, markAsRead } from '../../lib/api/notifications'
import type { Notification } from '../../lib/api/notifications'
import { useAuth } from '../../contexts/AuthContext'

export function NotificationBell() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

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
  }

  if (!user) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-sm rounded-md hover:bg-neutral-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Notifications"
      >
        <BellIcon className="h-6 w-6 text-secondary-text" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-error text-white text-xs font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-sm w-80 max-w-[90vw] bg-bg-card border border-neutral-200 rounded-lg shadow-lg z-50 max-h-[400px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-md border-b border-neutral-200">
            <h3 className="text-base font-semibold text-primary-text">Notifications</h3>
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-sm text-primary hover:underline"
            >
              View All
            </Link>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-md text-center text-secondary-text">Loading...</div>
            ) : recentNotifications.length === 0 ? (
              <div className="p-md text-center text-secondary-text">
                No new notifications
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
                    <p className="text-sm font-medium text-primary-text mb-xs">
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
          </div>
        </div>
      )}
    </div>
  )
}

