import { supabase } from '../supabase'

export type NotificationType = 'product_approved' | 'product_rejected' | 'invoice_blocked' | 'product_submitted'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  related_id: string | null
  read_at: string | null
  created_at: string
}

export interface NotificationFilters {
  type?: NotificationType
  read?: boolean
  limit?: number
  offset?: number
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  filters?: NotificationFilters
): Promise<Notification[]> {
  let query = supabase
    .from('notifications' as any)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (filters?.type) {
    query = query.eq('type', filters.type)
  }

  if (filters?.read !== undefined) {
    if (filters.read) {
      query = query.not('read_at', 'is', null)
    } else {
      query = query.is('read_at', null)
    }
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`)
  }

  return (data || []) as unknown as Notification[]
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications' as any)
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`)
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications' as any)
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)

  if (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`)
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications' as any)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)

  if (error) {
    throw new Error(`Failed to get unread count: ${error.message}`)
  }

  return count || 0
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications' as any)
    .delete()
    .eq('id', notificationId)

  if (error) {
    throw new Error(`Failed to delete notification: ${error.message}`)
  }
}

