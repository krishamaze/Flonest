import type { AuthUser, UserRole } from '../types'

// Permission constants
export const MANAGE_ORG_SETTINGS = 'manage_org_settings'
export const MANAGE_BRANCH_USERS = 'manage_branch_users'
export const CREATE_INVOICE = 'create_invoice'
export const VIEW_FINANCIALS = 'view_financials'
export const APPROVE_ACTIONS = 'approve_actions'
export const VIEW_BLOCKED_INVOICES = 'view_blocked_invoices'
export const MANAGE_PRODUCTS = 'manage_products'
export const MANAGE_INVENTORY = 'manage_inventory'
export const VIEW_REPORTS = 'view_reports'
export const MANAGE_CUSTOMERS = 'manage_customers'

export type Permission =
  | typeof MANAGE_ORG_SETTINGS
  | typeof MANAGE_BRANCH_USERS
  | typeof CREATE_INVOICE
  | typeof VIEW_FINANCIALS
  | typeof APPROVE_ACTIONS
  | typeof VIEW_BLOCKED_INVOICES
  | typeof MANAGE_PRODUCTS
  | typeof MANAGE_INVENTORY
  | typeof VIEW_REPORTS
  | typeof MANAGE_CUSTOMERS

// Role-based permissions map
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    MANAGE_ORG_SETTINGS,
    MANAGE_BRANCH_USERS,
    CREATE_INVOICE,
    VIEW_FINANCIALS,
    APPROVE_ACTIONS,
    VIEW_BLOCKED_INVOICES,
    MANAGE_PRODUCTS,
    MANAGE_INVENTORY,
    VIEW_REPORTS,
    MANAGE_CUSTOMERS,
  ],
  branch_head: [
    MANAGE_BRANCH_USERS,
    CREATE_INVOICE,
    VIEW_BLOCKED_INVOICES,
    MANAGE_PRODUCTS,
    MANAGE_INVENTORY,
    VIEW_REPORTS,
    MANAGE_CUSTOMERS,
  ],
  staff: [
    CREATE_INVOICE,
    MANAGE_CUSTOMERS,
  ],
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: AuthUser | null, permission: Permission): boolean {
  if (!user || user.isInternal) {
    // Internal users have platform-level permissions (handled separately)
    return false
  }

  if (!user.role) {
    return false
  }

  const permissions = ROLE_PERMISSIONS[user.role] || []
  return permissions.includes(permission)
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Check if user can manage users (owner or branch_head)
 */
export function canManageUsers(user: AuthUser | null): boolean {
  if (!user || user.isInternal) return false
  return user.role === 'owner' || user.role === 'branch_head'
}

/**
 * Check if user can approve actions (owner only)
 */
export function canApproveActions(user: AuthUser | null): boolean {
  if (!user || user.isInternal) return false
  return user.role === 'owner'
}

/**
 * Check if user can manage org settings (owner only)
 */
export function canManageOrgSettings(user: AuthUser | null): boolean {
  if (!user || user.isInternal) return false
  return user.role === 'owner'
}

/**
 * Check if user can view blocked invoices
 */
export function canViewBlockedInvoices(user: AuthUser | null): boolean {
  if (!user) return false
  // Internal users can view all blocked invoices (platform-level)
  if (user.isInternal) return true
  // Owner and branch_head can view blocked invoices in their org
  return user.role === 'owner' || user.role === 'branch_head'
}

