export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          gst_number: string | null
          gst_enabled: boolean
          state: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          gst_number?: string | null
          gst_enabled?: boolean
          state: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          gst_number?: string | null
          gst_enabled?: boolean
          state?: string
          created_at?: string
          updated_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          email: string
          role: 'owner' | 'staff' | 'viewer'
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          email: string
          role?: 'owner' | 'staff' | 'viewer'
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string
          email?: string
          role?: 'owner' | 'staff' | 'viewer'
          created_at?: string
        }
      }
      master_products: {
        Row: {
          id: string
          sku: string
          name: string
          base_price: number
          min_selling_price: number
          status: 'active' | 'inactive' | 'pending'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          name: string
          base_price: number
          min_selling_price: number
          status?: 'active' | 'inactive' | 'pending'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          name?: string
          base_price?: number
          min_selling_price?: number
          status?: 'active' | 'inactive' | 'pending'
          created_at?: string
          updated_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          tenant_id: string
          product_id: string
          quantity: number
          cost_price: number
          selling_price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          product_id: string
          quantity?: number
          cost_price: number
          selling_price: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          product_id?: string
          quantity?: number
          cost_price?: number
          selling_price?: number
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          tenant_id: string
          invoice_number: string
          subtotal: number
          cgst_amount: number
          sgst_amount: number
          total_amount: number
          status: 'draft' | 'finalized' | 'cancelled'
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          invoice_number: string
          subtotal: number
          cgst_amount?: number
          sgst_amount?: number
          total_amount: number
          status?: 'draft' | 'finalized' | 'cancelled'
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          invoice_number?: string
          subtotal?: number
          cgst_amount?: number
          sgst_amount?: number
          total_amount?: number
          status?: 'draft' | 'finalized' | 'cancelled'
          created_by?: string | null
          created_at?: string
        }
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          unit_price: number
          line_total: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity: number
          unit_price: number
          line_total: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
          line_total?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_tenant_id: {
        Args: Record<string, never>
        Returns: string
      }
      current_user_is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

