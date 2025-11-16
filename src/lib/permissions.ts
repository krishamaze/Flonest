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
export const MANAGE_AGENTS = 'manage_agents'
export const ISSUE_DC = 'issue_dc'
export const ACCEPT_DC = 'accept_dc'
export const CREATE_DC_SALE = 'create_dc_sale'
export const VIEW_AGENT_PORTAL = 'view_agent_portal'

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
  | typeof MANAGE_AGENTS
  | typeof ISSUE_DC
  | typeof ACCEPT_DC
  | typeof CREATE_DC_SALE
  | typeof VIEW_AGENT_PORTAL

// Role-based permissions map
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  org_owner: [
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
    MANAGE_AGENTS,
    ISSUE_DC,
    ACCEPT_DC,
    CREATE_DC_SALE,
    VIEW_AGENT_PORTAL,
  ],
  branch_head: [
    MANAGE_BRANCH_USERS,
    CREATE_INVOICE,
    VIEW_BLOCKED_INVOICES,
    MANAGE_PRODUCTS,
    MANAGE_INVENTORY,
    VIEW_REPORTS,
    MANAGE_CUSTOMERS,
    ACCEPT_DC,
    CREATE_DC_SALE,
    VIEW_AGENT_PORTAL,
  ],
  advisor: [
    CREATE_INVOICE,
    MANAGE_CUSTOMERS,
    ACCEPT_DC,
    CREATE_DC_SALE,
    VIEW_AGENT_PORTAL,
  ],
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: AuthUser | null, permission: Permission): boolean {
  if (!user) {
    return false
  }

  // Platform admins have platform-level permissions (handled separately)
  if (user.platformAdmin) {
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
 * Check if user can manage users (admin or branch_head)
 */
export function canManageUsers(user: AuthUser | null): boolean {
  if (!user || user.platformAdmin) return false
  return user.role === 'org_owner' || user.role === 'branch_head'
}

/**
 * Check if user can approve actions (admin only)
 */
export function canApproveActions(user: AuthUser | null): boolean {
  if (!user || user.platformAdmin) return false
  return user.role === 'org_owner'
}

/**
 * Check if user can manage org settings (admin only)
 */
export function canManageOrgSettings(user: AuthUser | null): boolean {
  if (!user || user.platformAdmin) return false
  return user.role === 'org_owner'
}

/**
 * Check if user can view blocked invoices
 */
export function canViewBlockedInvoices(user: AuthUser | null): boolean {
  if (!user) return false
  // Platform admins can view all blocked invoices (platform-level)
  if (user.platformAdmin) return true
  // OrgOwner and branch_head can view blocked invoices in their org
  return user.role === 'org_owner' || user.role === 'branch_head'
}

/**
 * Check if user can manage agents (admin only, business context)
 */
export function canManageAgents(user: AuthUser | null): boolean {
  if (!user || user.platformAdmin) return false
  if (user.contextMode === 'agent') return false // Not in agent context
  return user.role === 'org_owner'
}

/**
 * Check if user can access agent portal (must have agent relationship)
 */
export function canAccessAgentPortal(user: AuthUser | null): boolean {
  if (!user || user.platformAdmin) return false
  return user.agentContext !== undefined
}

/**
 * Check if user is in agent context mode
 */
export function isAgentContext(user: AuthUser | null): boolean {
  if (!user) return false
  return user.contextMode === 'agent'
}

/**
 * Check if user is in business context mode
 */
export function isBusinessContext(user: AuthUser | null): boolean {
  if (!user) return false
  return user.contextMode === 'business'
}
