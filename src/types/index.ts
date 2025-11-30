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
export type AgentRelationship = Database['public']['Tables']['agent_relationships']['Row']
export type AgentPortalPermission = Database['public']['Tables']['agent_portal_permissions']['Row']
export type DeliveryChallan = Database['public']['Tables']['delivery_challans']['Row']
export type DCItem = Database['public']['Tables']['dc_items']['Row']
export type DCStockLedger = Database['public']['Tables']['dc_stock_ledger']['Row']
export type BillingPlan = Database['public']['Tables']['billing_plans']['Row']
export type OrgSubscription = Database['public']['Tables']['org_subscriptions']['Row']
export type SubscriptionEvent = Database['public']['Tables']['subscription_events']['Row']

export type UserRole = 'org_owner' | 'branch_head' | 'advisor' | 'agent'
export type ProductStatus = 'active' | 'inactive' | 'pending'
export type ApprovalStatus = 'pending' | 'auto_pass' | 'approved' | 'rejected'
export type InvoiceStatus = 'draft' | 'finalized' | 'cancelled'

export interface AuthUser {
  id: string
  email: string
  orgId: string | null // null if user hasn't joined an org yet
  role: UserRole | null // null if user hasn't joined an org yet
  branchId: string | null // null for org_owner (org-wide) or if user hasn't joined an org yet
  platformAdmin: boolean // Platform-level admin access (internal SaaS team)
  
  // Context mode for agent portal
  contextMode: 'business' | 'agent'
  agentContext?: {
    senderOrgId: string
    senderOrgName: string
    relationshipId: string
    canManage: boolean // true if they're the agent or have portal permissions
  }
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
  tax_rate?: number | null
  hsn_sac_code?: string | null
}

export interface ProductWithStock extends Product {
  current_stock: number
}

export interface ProductWithMaster extends Product {
  tax_rate: number | null
  hsn_sac_code: string | null
  master_product: {
    id: string
    gst_rate: number | null
    hsn_code: string | null
    base_price: number | null
    name: string
    sku: string
    approval_status: ApprovalStatus
  } | null
}

export interface HSNMaster {
  hsn_code: string
  description: string
  gst_rate: number
  category: string | null
  chapter_code: string | null
  is_active: boolean
  last_updated_at: string | null
  created_at: string | null
}

export interface CategoryMap {
  id: string
  category_name: string
  suggested_hsn_code: string | null
  confidence_score: number
  created_at: string | null
  updated_at: string | null
}

export interface MasterProductReview {
  id: string
  master_product_id: string
  action: 'submitted' | 'approved' | 'rejected' | 'edited' | 'auto_passed' | 'migrated'
  reviewed_by: string | null
  reviewed_at: string
  note: string | null
  field_changes: Record<string, any> | null
  previous_approval_status: string | null
  new_approval_status: string | null
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
  invalid_serials?: string[]
  validation_errors?: string[]
  stock_available?: number
}

export interface CustomerWithMaster extends Customer {
  master_customer: MasterCustomer
  status: 'name_only' | 'edited' | 'verified' | null
  name: string | null
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

export interface DeliveryChallanWithItems extends DeliveryChallan {
  dc_items: DCItem[]
  sender_org: Org
}

export interface DCStockSummary {
  product_id: string
  product_name: string
  product_sku: string
  current_stock: number
}

