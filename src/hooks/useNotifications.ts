import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  type Notification,
  type NotificationFilters,
} from '../lib/api/notifications'

/**
 * Query hook to get notifications for a user
 */
export const useNotifications = (
  userId: string | null | undefined,
  filters?: NotificationFilters
) => {
  return useQuery<Notification[]>({
    queryKey: ['notifications', userId, filters],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required')
      return getNotifications(userId, filters)
    },
    enabled: !!userId,
    staleTime: 10 * 1000, // 10 seconds
    refetchOnWindowFocus: true, // Refetch notifications on window focus
    refetchInterval: 30 * 1000, // Poll every 30 seconds for new notifications
  })
}

/**
 * Query hook to get unread notification count
 */
export const useUnreadCount = (userId: string | null | undefined) => {
  return useQuery<number>({
    queryKey: ['notifications', 'unread-count', userId],
    queryFn: async () => {
      if (!userId) return 0
      return getUnreadCount(userId)
    },
    enabled: !!userId,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000, // Poll every 30 seconds
  })
}

/**
 * Mutation hook to mark a notification as read
 */
export const useMarkAsRead = (userId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, { previousNotifications: Notification[] | undefined; previousUnreadCount: number | undefined }>({
    mutationFn: (notificationId: string) => markAsRead(notificationId),
    // Optimistic update
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', userId] })
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread-count', userId] })

      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications', userId])
      const previousUnreadCount = queryClient.getQueryData<number>(['notifications', 'unread-count', userId])

      // Optimistically update notification
      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(
          ['notifications', userId],
          previousNotifications.map((n) =>
            n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
          )
        )
      }

      // Optimistically decrement unread count
      if (previousUnreadCount !== undefined) {
        queryClient.setQueryData<number>(
          ['notifications', 'unread-count', userId],
          Math.max(0, previousUnreadCount - 1)
        )
      }

      return { previousNotifications, previousUnreadCount }
    },
    onError: (_error, _notificationId, context) => {
      // Revert on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications', userId], context.previousNotifications)
      }
      if (context?.previousUnreadCount !== undefined) {
        queryClient.setQueryData(['notifications', 'unread-count', userId], context.previousUnreadCount)
      }
    },
    onSuccess: () => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count', userId] })
    },
  })
}

/**
 * Mutation hook to mark all notifications as read
 */
export const useMarkAllAsRead = (userId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, void, { previousNotifications: Notification[] | undefined; previousUnreadCount: number | undefined }>({
    mutationFn: async () => {
      if (!userId) throw new Error('User ID is required')
      return markAllAsRead(userId)
    },
    // Optimistic update
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications', userId] })
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread-count', userId] })

      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications', userId])
      const previousUnreadCount = queryClient.getQueryData<number>(['notifications', 'unread-count', userId])

      // Optimistically mark all as read
      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(
          ['notifications', userId],
          previousNotifications.map((n) => ({
            ...n,
            read_at: n.read_at || new Date().toISOString(),
          }))
        )
      }

      // Optimistically set unread count to 0
      queryClient.setQueryData<number>(['notifications', 'unread-count', userId], 0)

      return { previousNotifications, previousUnreadCount }
    },
    onError: (_error, _variables, context) => {
      // Revert on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications', userId], context.previousNotifications)
      }
      if (context?.previousUnreadCount !== undefined) {
        queryClient.setQueryData(['notifications', 'unread-count', userId], context.previousUnreadCount)
      }
    },
    onSuccess: () => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count', userId] })
    },
  })
}

/**
 * Mutation hook to delete a notification
 */
export const useDeleteNotification = (userId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, { previousNotifications: Notification[] | undefined; previousUnreadCount: number | undefined }>({
    mutationFn: (notificationId: string) => deleteNotification(notificationId),
    // Optimistic update
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', userId] })
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread-count', userId] })

      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications', userId])
      const previousUnreadCount = queryClient.getQueryData<number>(['notifications', 'unread-count', userId])

      // Find if the notification being deleted is unread
      const deletedNotification = previousNotifications?.find((n) => n.id === notificationId)
      const wasUnread = deletedNotification && !deletedNotification.read_at

      // Optimistically remove notification
      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(
          ['notifications', userId],
          previousNotifications.filter((n) => n.id !== notificationId)
        )
      }

      // Optimistically decrement unread count if it was unread
      if (wasUnread && previousUnreadCount !== undefined) {
        queryClient.setQueryData<number>(
          ['notifications', 'unread-count', userId],
          Math.max(0, previousUnreadCount - 1)
        )
      }

      return { previousNotifications, previousUnreadCount }
    },
    onError: (_error, _notificationId, context) => {
      // Revert on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications', userId], context.previousNotifications)
      }
      if (context?.previousUnreadCount !== undefined) {
        queryClient.setQueryData(['notifications', 'unread-count', userId], context.previousUnreadCount)
      }
    },
    onSuccess: () => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count', userId] })
    },
  })
}
