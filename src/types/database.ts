export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_versions: {
        Row: {
          created_at: string | null
          id: string
          is_current: boolean | null
          release_notes: string | null
          released_at: string | null
          rollback_sql: string | null
          schema_version: string | null
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_current?: boolean | null
          release_notes?: string | null
          released_at?: string | null
          rollback_sql?: string | null
          schema_version?: string | null
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_current?: boolean | null
          release_notes?: string | null
          released_at?: string | null
          rollback_sql?: string | null
          schema_version?: string | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          branch_head_id: string | null
          created_at: string | null
          id: string
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          branch_head_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          branch_head_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_branch_head_id_fkey"
            columns: ["branch_head_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      category_map: {
        Row: {
          category_name: string
          confidence_score: number | null
          created_at: string | null
          id: string
          suggested_hsn_code: string | null
          updated_at: string | null
        }
        Insert: {
          category_name: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          suggested_hsn_code?: string | null
          updated_at?: string | null
        }
        Update: {
          category_name?: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          suggested_hsn_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_map_suggested_hsn_code_fkey"
            columns: ["suggested_hsn_code"]
            isOneToOne: false
            referencedRelation: "hsn_master"
            referencedColumns: ["hsn_code"]
          },
        ]
      }
      customer_identifiers: {
        Row: {
          created_at: string | null
          id: string
          identifier_type: string
          is_primary: boolean
          master_customer_id: string
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          identifier_type: string
          is_primary?: boolean
          master_customer_id: string
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          identifier_type?: string
          is_primary?: boolean
          master_customer_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_identifiers_master_customer_id_fkey"
            columns: ["master_customer_id"]
            isOneToOne: false
            referencedRelation: "master_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          alias_name: string | null
          billing_address: string | null
          created_at: string | null
          created_by: string | null
          id: string
          master_customer_id: string
          notes: string | null
          org_id: string
          shipping_address: string | null
          updated_at: string | null
        }
        Insert: {
          alias_name?: string | null
          billing_address?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          master_customer_id: string
          notes?: string | null
          org_id: string
          shipping_address?: string | null
          updated_at?: string | null
        }
        Update: {
          alias_name?: string | null
          billing_address?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          master_customer_id?: string
          notes?: string | null
          org_id?: string
          shipping_address?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_master_customer_id_fkey"
            columns: ["master_customer_id"]
            isOneToOne: false
            referencedRelation: "master_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      hsn_master: {
        Row: {
          category: string | null
          chapter_code: string | null
          created_at: string | null
          description: string
          gst_rate: number
          hsn_code: string
          is_active: boolean | null
          last_updated_at: string | null
        }
        Insert: {
          category?: string | null
          chapter_code?: string | null
          created_at?: string | null
          description: string
          gst_rate: number
          hsn_code: string
          is_active?: boolean | null
          last_updated_at?: string | null
        }
        Update: {
          category?: string | null
          chapter_code?: string | null
          created_at?: string | null
          description?: string
          gst_rate?: number
          hsn_code?: string
          is_active?: boolean | null
          last_updated_at?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          cost_price: number
          created_at: string | null
          id: string
          org_id: string | null
          product_id: string | null
          quantity: number
          selling_price: number
          updated_at: string | null
        }
        Insert: {
          cost_price: number
          created_at?: string | null
          id?: string
          org_id?: string | null
          product_id?: string | null
          quantity?: number
          selling_price: number
          updated_at?: string | null
        }
        Update: {
          cost_price?: number
          created_at?: string | null
          id?: string
          org_id?: string | null
          product_id?: string | null
          quantity?: number
          selling_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_item_serials: {
        Row: {
          created_at: string | null
          id: string
          invoice_item_id: string
          serial_number: string
          status: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_item_id: string
          serial_number: string
          status?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_item_id?: string
          serial_number?: string
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_item_serials_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string | null
          id: string
          invoice_id: string | null
          line_total: number
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          line_total: number
          product_id?: string | null
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          line_total?: number
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          branch_id: string | null
          cgst_amount: number | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          draft_data: Json | null
          draft_session_id: string | null
          id: string
          igst_amount: number | null
          invoice_number: string
          org_id: string | null
          sgst_amount: number | null
          status: string | null
          subtotal: number
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          cgst_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          draft_data?: Json | null
          draft_session_id?: string | null
          id?: string
          igst_amount?: number | null
          invoice_number: string
          org_id?: string | null
          sgst_amount?: number | null
          status?: string | null
          subtotal: number
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          cgst_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          draft_data?: Json | null
          draft_session_id?: string | null
          id?: string
          igst_amount?: number | null
          invoice_number?: string
          org_id?: string | null
          sgst_amount?: number | null
          status?: string | null
          subtotal?: number
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      master_customers: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          gstin: string | null
          id: string
          last_seen_at: string | null
          legal_name: string
          mobile: string | null
          pan: string | null
          state_code: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          last_seen_at?: string | null
          legal_name: string
          mobile?: string | null
          pan?: string | null
          state_code?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          last_seen_at?: string | null
          legal_name?: string
          mobile?: string | null
          pan?: string | null
          state_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      master_product_reviews: {
        Row: {
          action: string
          field_changes: Json | null
          id: string
          master_product_id: string
          new_approval_status: string | null
          note: string | null
          previous_approval_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          action: string
          field_changes?: Json | null
          id?: string
          master_product_id: string
          new_approval_status?: string | null
          note?: string | null
          previous_approval_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          action?: string
          field_changes?: Json | null
          id?: string
          master_product_id?: string
          new_approval_status?: string | null
          note?: string | null
          previous_approval_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_product_reviews_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_product_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      master_products: {
        Row: {
          approval_status: string | null
          barcode_ean: string | null
          base_price: number
          base_unit: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          gst_rate: number | null
          gst_type: string | null
          hsn_code: string | null
          id: string
          min_selling_price: number
          name: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sku: string
          status: string | null
          submitted_org_id: string | null
          updated_at: string | null
        }
        Insert: {
          approval_status?: string | null
          barcode_ean?: string | null
          base_price: number
          base_unit?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          gst_rate?: number | null
          gst_type?: string | null
          hsn_code?: string | null
          id?: string
          min_selling_price: number
          name: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sku: string
          status?: string | null
          submitted_org_id?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_status?: string | null
          barcode_ean?: string | null
          base_price?: number
          base_unit?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          gst_rate?: number | null
          gst_type?: string | null
          hsn_code?: string | null
          id?: string
          min_selling_price?: number
          name?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sku?: string
          status?: string | null
          submitted_org_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_products_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_products_submitted_org_id_fkey"
            columns: ["submitted_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          membership_status: string | null
          org_id: string | null
          profile_id: string | null
          role: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          membership_status?: string | null
          org_id?: string | null
          profile_id?: string | null
          role?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          membership_status?: string | null
          org_id?: string | null
          profile_id?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read_at: string | null
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read_at?: string | null
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read_at?: string | null
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string | null
          gst_enabled: boolean | null
          gst_number: string | null
          id: string
          name: string
          pincode: string | null
          slug: string
          state: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          gst_enabled?: boolean | null
          gst_number?: string | null
          id?: string
          name: string
          pincode?: string | null
          slug: string
          state: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          gst_enabled?: boolean | null
          gst_number?: string | null
          id?: string
          name?: string
          pincode?: string | null
          slug?: string
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_serials: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          product_id: string
          reserved_at: string | null
          reserved_expires_at: string | null
          serial_number: string
          source_txn_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          product_id: string
          reserved_at?: string | null
          reserved_expires_at?: string | null
          serial_number: string
          source_txn_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          product_id?: string
          reserved_at?: string | null
          reserved_expires_at?: string | null
          serial_number?: string
          source_txn_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_serials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_serials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_serials_source_txn_id_fkey"
            columns: ["source_txn_id"]
            isOneToOne: false
            referencedRelation: "stock_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          alias_name: string | null
          branch_id: string | null
          category: string | null
          cost_price: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          ean: string | null
          id: string
          master_product_id: string | null
          min_stock_level: number | null
          name: string
          org_id: string
          selling_price: number | null
          serial_tracked: boolean
          sku: string
          status: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          alias_name?: string | null
          branch_id?: string | null
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ean?: string | null
          id?: string
          master_product_id?: string | null
          min_stock_level?: number | null
          name: string
          org_id: string
          selling_price?: number | null
          serial_tracked?: boolean
          sku: string
          status?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          alias_name?: string | null
          branch_id?: string | null
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ean?: string | null
          id?: string
          master_product_id?: string | null
          min_stock_level?: number | null
          name?: string
          org_id?: string
          selling_price?: number | null
          serial_tracked?: boolean
          sku?: string
          status?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_internal: boolean
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_internal?: boolean
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_internal?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      stock_ledger: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          org_id: string
          product_id: string
          quantity: number
          transaction_type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id: string
          product_id: string
          quantity: number
          transaction_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          product_id?: string
          quantity?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_membership: { Args: { p_membership_id: string }; Returns: Json }
      auto_link_product_to_master:
        | { Args: { p_org_id: string; p_product_id: string }; Returns: string }
        | {
            Args: { p_org_id: string; p_product_id: string; p_user_id?: string }
            Returns: string
          }
      auto_save_invoice_draft: {
        Args: { p_draft_data: Json; p_org_id: string; p_user_id: string }
        Returns: string
      }
      check_serial_status: {
        Args: { p_org_id: string; p_serial_number: string }
        Returns: Json
      }
      create_default_org_for_user: { Args: never; Returns: Json }
      create_product_from_master: {
        Args: {
          p_alias_name?: string
          p_barcode_ean?: string
          p_category?: string
          p_cost_price?: number
          p_created_by?: string
          p_master_product_id: string
          p_min_stock_level?: number
          p_org_id: string
          p_selling_price?: number
          p_sku?: string
          p_unit?: string
        }
        Returns: string
      }
      create_staff_membership: {
        Args: { p_branch_id: string; p_email: string; p_profile_id: string }
        Returns: Json
      }
      create_user_org: {
        Args: { org_name: string; org_slug: string; org_state?: string }
        Returns: {
          created_at: string
          gst_enabled: boolean
          gst_number: string
          id: string
          name: string
          slug: string
          state: string
          updated_at: string
        }[]
      }
      current_user_branch_id: { Args: never; Returns: string }
      current_user_branch_ids: { Args: never; Returns: string[] }
      current_user_is_admin: { Args: never; Returns: boolean }
      current_user_is_branch_head: { Args: never; Returns: boolean }
      current_user_is_internal: { Args: never; Returns: boolean }
      current_user_is_owner: { Args: never; Returns: boolean }
      current_user_org_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      current_user_tenant_id: { Args: never; Returns: string }
      get_current_app_version: { Args: never; Returns: Json }
      get_master_product_gst_rate: {
        Args: { p_master_product_id: string }
        Returns: number
      }
      is_internal_user: { Args: { user_id: string }; Returns: boolean }
      reload_schema_cache: { Args: never; Returns: undefined }
      reserve_serials_for_invoice: {
        Args: {
          p_invoice_item_id: string
          p_org_id: string
          p_serial_numbers: string[]
        }
        Returns: Json
      }
      review_master_product: {
        Args: {
          p_action: string
          p_changes?: Json
          p_hsn_code?: string
          p_master_product_id: string
          p_note?: string
          p_reviewer_id: string
        }
        Returns: boolean
      }
      search_master_products:
        | {
            Args: {
              include_pending?: boolean
              result_limit?: number
              result_offset?: number
              search_category?: string
              search_ean?: string
              search_query?: string
              search_sku?: string
            }
            Returns: {
              approval_status: string
              barcode_ean: string
              base_price: number
              base_unit: string
              category: string
              created_at: string
              gst_rate: number
              gst_type: string
              hsn_code: string
              id: string
              name: string
              sku: string
              status: string
              updated_at: string
            }[]
          }
        | {
            Args: {
              result_limit?: number
              result_offset?: number
              search_category?: string
              search_ean?: string
              search_query?: string
              search_sku?: string
            }
            Returns: {
              barcode_ean: string
              base_price: number
              base_unit: string
              category: string
              created_at: string
              gst_rate: number
              gst_type: string
              hsn_code: string
              id: string
              name: string
              sku: string
              status: string
              updated_at: string
            }[]
          }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_master_product_suggestion: {
        Args: {
          p_barcode_ean?: string
          p_base_price?: number
          p_base_unit?: string
          p_category?: string
          p_name: string
          p_org_id: string
          p_sku: string
          p_suggested_hsn_code?: string
          p_user_id: string
        }
        Returns: string
      }
      update_app_version:
        | {
            Args: { new_version: string; release_notes?: string }
            Returns: Json
          }
        | {
            Args: {
              new_version: string
              release_notes?: string
              rollback_sql?: string
              schema_version?: string
            }
            Returns: Json
          }
      upsert_master_customer: {
        Args: {
          p_address?: string
          p_email?: string
          p_gstin: string
          p_legal_name: string
          p_mobile: string
        }
        Returns: string
      }
      validate_invoice_items:
        | { Args: { p_items: Json; p_org_id: string }; Returns: Json }
        | {
            Args: { p_allow_draft?: boolean; p_items: Json; p_org_id: string }
            Returns: Json
          }
      validate_scanner_codes: {
        Args: { p_codes: string[]; p_org_id: string }
        Returns: Json
      }
      wrap_draft_data: { Args: { p_data: Json }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
