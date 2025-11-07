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
export type MasterCustomer = Database['public']['Tables']['master_customers']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']

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

export interface ProductWithMaster extends Product {
  serial_tracked?: boolean
  master_product: {
    id: string
    gst_rate: number | null
    hsn_code: string | null
    base_price: number | null
    name: string
    sku: string
  } | null
}

export interface StockLedgerFormData {
  product_id: string
  transaction_type: 'in' | 'out' | 'adjustment'
  quantity: number
  notes?: string
}

export interface CustomerFormData {
  alias_name?: string
  billing_address?: string
  shipping_address?: string
  notes?: string
}

export interface InvoiceFormData {
  customer_id: string
  invoice_number?: string
  items: InvoiceItemFormData[]
  notes?: string
}

export interface InvoiceItemFormData {
  product_id: string
  quantity: number
  unit_price: number
  line_total: number
  serials?: string[]
  serial_tracked?: boolean
}

export interface CustomerWithMaster extends Customer {
  master_customer: MasterCustomer
}

export interface ScanResult {
  code: string
  type: 'serialnumber' | 'productcode' | 'unknown'
  product_id?: string
  status: 'valid' | 'invalid' | 'not_found'
  message?: string
}

export interface DraftInvoiceData {
  invoice_id?: string
  customer_id?: string
  items: InvoiceItemFormData[]
}

