import type { Database } from './database'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Org = Database['public']['Tables']['orgs']['Row']
export type Membership = Database['public']['Tables']['memberships']['Row']
export type MasterProduct = Database['public']['Tables']['master_products']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Inventory = Database['public']['Tables']['inventory']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
export type StockLedger = Database['public']['Tables']['stock_ledger']['Row']

export type UserRole = 'owner' | 'staff' | 'viewer'
export type ProductStatus = 'active' | 'inactive' | 'pending'
export type InvoiceStatus = 'draft' | 'finalized' | 'cancelled'

export interface AuthUser {
  id: string
  email: string
  orgId: string
  role: UserRole
}

export interface InventoryWithProduct extends Inventory {
  product: MasterProduct
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
}

export interface ProductFormData {
  name: string
  sku: string
  ean?: string
  description?: string
  category?: string
  unit?: string
  cost_price?: number
  selling_price?: number
  min_stock_level?: number
}

export interface ProductWithStock extends Product {
  current_stock: number
}

export interface StockLedgerFormData {
  product_id: string
  transaction_type: 'in' | 'out' | 'adjustment'
  quantity: number
  notes?: string
}

