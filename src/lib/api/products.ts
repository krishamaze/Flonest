import { supabase } from '../supabase'
import type { Product, ProductFormData } from '../../types'
import type { Database } from '../../types/database'

type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

export interface CreateProductFromMasterParams {
  master_product_id: string
  alias_name?: string
  unit?: string
  selling_price?: number
  cost_price?: number
  min_stock_level?: number
  sku?: string
  barcode_ean?: string
  category?: string
}

/**
 * Create an org product from a master product with optional overrides
 */
export async function createProductFromMaster(
  orgId: string,
  params: CreateProductFromMasterParams,
  createdBy?: string
): Promise<Product> {
  const { data: productId, error } = await supabase.rpc('create_product_from_master' as any, {
    p_org_id: orgId,
    p_master_product_id: params.master_product_id,
    p_alias_name: params.alias_name || null,
    p_unit: params.unit || null,
    p_selling_price: params.selling_price || null,
    p_cost_price: params.cost_price || null,
    p_min_stock_level: params.min_stock_level || 0,
    p_sku: params.sku || null,
    p_barcode_ean: params.barcode_ean || null,
    p_category: params.category || null,
    p_created_by: createdBy || null,
  })

  if (error) {
    if (error.code === '23505') {
      throw new Error('Product already linked to this master product for this organization')
    }
    throw new Error(`Failed to create product from master: ${error.message}`)
  }

  if (!productId || typeof productId !== 'string') {
    throw new Error('Failed to create product: no ID returned')
  }

  // Fetch the created product
  return await getProduct(productId)
}

/**
 * Create a new product for the organization (org-only, not from master)
 */
export async function createProduct(orgId: string, data: ProductFormData): Promise<Product> {
  const productData: ProductInsert = {
    org_id: orgId,
    name: data.name,
    sku: data.sku,
    ean: data.ean || null,
    description: data.description || null,
    category: data.category || null,
    unit: data.unit || 'pcs',
    cost_price: data.cost_price || null,
    selling_price: data.selling_price || null,
    min_stock_level: data.min_stock_level || 0,
    status: 'active',
  }

  const { data: product, error } = await supabase
    .from('products')
    .insert([productData])
    .select()
    .single()

  if (error) {
    // Check for unique constraint violation (duplicate SKU)
    if (error.code === '23505') {
      throw new Error(`Product with SKU "${data.sku}" already exists in this organization`)
    }
    throw new Error(`Failed to create product: ${error.message}`)
  }

  return product
}

/**
 * Update an existing product
 */
export async function updateProduct(productId: string, data: Partial<ProductFormData>): Promise<Product> {
  const updateData: ProductUpdate = {
    name: data.name,
    sku: data.sku,
    ean: data.ean !== undefined ? data.ean : undefined,
    description: data.description !== undefined ? data.description : undefined,
    category: data.category !== undefined ? data.category : undefined,
    unit: data.unit !== undefined ? data.unit : undefined,
    cost_price: data.cost_price !== undefined ? data.cost_price : undefined,
    selling_price: data.selling_price !== undefined ? data.selling_price : undefined,
    min_stock_level: data.min_stock_level !== undefined ? data.min_stock_level : undefined,
    updated_at: new Date().toISOString(),
  }

  // Remove undefined values
  Object.keys(updateData).forEach(key => {
    if (updateData[key as keyof ProductUpdate] === undefined) {
      delete updateData[key as keyof ProductUpdate]
    }
  })

  const { data: product, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', productId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Product with SKU "${data.sku}" already exists in this organization`)
    }
    throw new Error(`Failed to update product: ${error.message}`)
  }

  if (!product) {
    throw new Error('Product not found')
  }

  return product
}

/**
 * Soft delete a product (set status to 'inactive')
 */
export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', productId)

  if (error) {
    throw new Error(`Failed to delete product: ${error.message}`)
  }
}

/**
 * Get all products for an organization with pagination and filtering
 * Includes master product data (GST rate, HSN code, base price) when available
 */
export async function getProducts(
  orgId: string,
  filters?: {
    status?: 'active' | 'inactive'
    category?: string
    search?: string
  },
  pagination?: {
    page?: number
    pageSize?: number
  }
): Promise<{ data: Product[]; total: number; page: number; pageSize: number }> {
  const page = pagination?.page || 1
  const pageSize = pagination?.pageSize || 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Include master product data for GST calculations
  let query = supabase
    .from('products')
    .select(`
      *,
      master_product:master_products(
        id,
        gst_rate,
        hsn_code,
        base_price,
        name,
        sku,
        approval_status
      )
    `, { count: 'exact' })
    .eq('org_id', orgId)

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  if (filters?.search) {
    const searchTerm = filters.search.toLowerCase()
    query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,ean.ilike.%${searchTerm}%`)
  }

  // Apply pagination
  query = query.order('created_at', { ascending: false }).range(from, to)

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`)
  }

  return {
    data: data || [],
    total: count || 0,
    page,
    pageSize,
  }
}

/**
 * Get all products for an organization (backward compatibility - no pagination)
 * Returns products with master_product data for GST calculations
 */
export async function getAllProducts(orgId: string, filters?: { status?: 'active' | 'inactive' }): Promise<any[]> {
  const result = await getProducts(orgId, filters, { page: 1, pageSize: 1000 })
  return result.data
}

/**
 * Get a single product by ID
 * Includes master product data (GST rate, HSN code, base price) when available
 */
export async function getProduct(productId: string): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      master_product:master_products(
        id,
        gst_rate,
        hsn_code,
        base_price,
        name,
        sku,
        approval_status
      )
    `)
    .eq('id', productId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch product: ${error.message}`)
  }

  if (!data) {
    throw new Error('Product not found')
  }

  return data
}

