import type { Database } from './database'

export type Tenant = Database['public']['Tables']['tenants']['Row']
export type TeamMember = Database['public']['Tables']['team_members']['Row']
export type MasterProduct = Database['public']['Tables']['master_products']['Row']
export type Inventory = Database['public']['Tables']['inventory']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']

export type UserRole = 'owner' | 'staff' | 'viewer'
export type ProductStatus = 'active' | 'inactive' | 'pending'
export type InvoiceStatus = 'draft' | 'finalized' | 'cancelled'

export interface AuthUser {
  id: string
  email: string
  tenantId: string
  role: UserRole
}

export interface InventoryWithProduct extends Inventory {
  product: MasterProduct
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
}

