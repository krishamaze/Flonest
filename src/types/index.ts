import type { Database } from './database'

export type Tenant = Database['public']['Tables']['tenants']['Row']
export type User = Database['public']['Tables']['users']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type InventoryTransaction = Database['public']['Tables']['inventory_transactions']['Row']

export type UserRole = 'admin' | 'manager' | 'staff'
export type TransactionType = 'in' | 'out' | 'adjustment'

export interface AuthUser {
  id: string
  email: string
  tenantId: string
  role: UserRole
  fullName: string | null
}

export interface ProductWithStock extends Product {
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
}

