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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          tenant_id: string
          email: string
          full_name: string | null
          role: 'admin' | 'manager' | 'staff'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          email: string
          full_name?: string | null
          role?: 'admin' | 'manager' | 'staff'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          email?: string
          full_name?: string | null
          role?: 'admin' | 'manager' | 'staff'
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          tenant_id: string
          name: string
          sku: string
          description: string | null
          category: string | null
          unit_price: number
          quantity: number
          min_stock_level: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          sku: string
          description?: string | null
          category?: string | null
          unit_price: number
          quantity?: number
          min_stock_level?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          sku?: string
          description?: string | null
          category?: string | null
          unit_price?: number
          quantity?: number
          min_stock_level?: number
          created_at?: string
          updated_at?: string
        }
      }
      inventory_transactions: {
        Row: {
          id: string
          tenant_id: string
          product_id: string
          type: 'in' | 'out' | 'adjustment'
          quantity: number
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          product_id: string
          type: 'in' | 'out' | 'adjustment'
          quantity: number
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          product_id?: string
          type?: 'in' | 'out' | 'adjustment'
          quantity?: number
          notes?: string | null
          created_by?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

