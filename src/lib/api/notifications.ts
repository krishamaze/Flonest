import { supabase } from '../supabase'

export type NotificationType = 
  | 'product_approved' 
  | 'product_rejected' 
  | 'invoice_blocked' 
  | 'product_submitted'
  | 'agent_invited'
  | 'agent_dc_issued'
  | 'agent_dc_accepted'
  | 'agent_dc_rejected'
  | 'agent_sale_created'
  | 'dc_accepted'
  | 'dc_rejected'

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

/**
 * Create a notification
 */
async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications' as any)
    .insert({
      user_id: userId,
      type,
      title,
      message,
      related_id: relatedId || null,
    })

  if (error) {
    console.error('Failed to create notification:', error)
  }
}

// Agent-related notification creators

/**
 * Notify agent when they are invited
 */
export async function notifyAgentInvited(
  agentUserId: string,
  senderOrgName: string,
  relationshipId: string
): Promise<void> {
  await createNotification(
    agentUserId,
    'agent_invited',
    'Agent Invitation',
    `You have been appointed as an agent for ${senderOrgName}`,
    relationshipId
  )
}

/**
 * Notify agent when a DC is issued
 */
export async function notifyAgentDCIssued(
  agentUserId: string,
  dcNumber: string,
  dcId: string
): Promise<void> {
  await createNotification(
    agentUserId,
    'agent_dc_issued',
    'New Delivery Challan',
    `You have received delivery challan ${dcNumber}`,
    dcId
  )
}

/**
 * Notify sender when agent accepts DC
 */
export async function notifySenderDCAccepted(
  senderOrgAdmins: string[],
  dcNumber: string,
  agentName: string,
  dcId: string
): Promise<void> {
  for (const adminId of senderOrgAdmins) {
    await createNotification(
      adminId,
      'dc_accepted',
      'DC Accepted',
      `Agent ${agentName} has accepted delivery challan ${dcNumber}`,
      dcId
    )
  }
}

/**
 * Notify sender when agent rejects DC
 */
export async function notifySenderDCRejected(
  senderOrgAdmins: string[],
  dcNumber: string,
  agentName: string,
  reason: string,
  dcId: string
): Promise<void> {
  for (const adminId of senderOrgAdmins) {
    await createNotification(
      adminId,
      'dc_rejected',
      'DC Rejected',
      `Agent ${agentName} rejected delivery challan ${dcNumber}. Reason: ${reason}`,
      dcId
    )
  }
}

/**
 * Notify sender when agent creates a sale
 */
export async function notifySenderAgentSaleCreated(
  senderOrgAdmins: string[],
  invoiceNumber: string,
  agentName: string,
  amount: number,
  invoiceId: string
): Promise<void> {
  for (const adminId of senderOrgAdmins) {
    await createNotification(
      adminId,
      'agent_sale_created',
      'Agent Sale Created',
      `Agent ${agentName} created invoice ${invoiceNumber} for ₹${amount.toLocaleString('en-IN')}`,
      invoiceId
    )
  }
}

/**
 * Get org admins for notifications
 */
export async function getOrgAdmins(orgId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('profile_id')
    .eq('org_id', orgId)
    .eq('role', 'admin')
    .eq('membership_status', 'active')

  if (error) {
    console.error('Failed to get org admins:', error)
    return []
  }

  return (data || []).map(m => m.profile_id).filter((id): id is string => id !== null)
}

