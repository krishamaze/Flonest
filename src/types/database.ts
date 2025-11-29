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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_cash_ledger: {
        Row: {
          agent_user_id: string
          amount: number
          created_at: string | null
          created_by: string | null
          deposited_to: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          proof_url: string | null
          reference_number: string | null
          rejection_reason: string | null
          sender_org_id: string
          status: string | null
          transaction_type: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          agent_user_id: string
          amount: number
          created_at?: string | null
          created_by?: string | null
          deposited_to?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          proof_url?: string | null
          reference_number?: string | null
          rejection_reason?: string | null
          sender_org_id: string
          status?: string | null
          transaction_type: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          agent_user_id?: string
          amount?: number
          created_at?: string | null
          created_by?: string | null
          deposited_to?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          proof_url?: string | null
          reference_number?: string | null
          rejection_reason?: string | null
          sender_org_id?: string
          status?: string | null
          transaction_type?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_cash_ledger_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_cash_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_cash_ledger_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_cash_ledger_sender_org_id_fkey"
            columns: ["sender_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_cash_ledger_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_portal_permissions: {
        Row: {
          agent_relationship_id: string
          created_at: string | null
          granted_at: string | null
          granted_by: string | null
          helper_user_id: string
          id: string
        }
        Insert: {
          agent_relationship_id: string
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          helper_user_id: string
          id?: string
        }
        Update: {
          agent_relationship_id?: string
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          helper_user_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_portal_permissions_agent_relationship_id_fkey"
            columns: ["agent_relationship_id"]
            isOneToOne: false
            referencedRelation: "agent_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_portal_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_portal_permissions_helper_user_id_fkey"
            columns: ["helper_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_relationships: {
        Row: {
          accepted_at: string | null
          agent_user_id: string
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          notes: string | null
          sender_org_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          agent_user_id: string
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          notes?: string | null
          sender_org_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          agent_user_id?: string
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          notes?: string | null
          sender_org_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_relationships_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_relationships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_relationships_sender_org_id_fkey"
            columns: ["sender_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      app_versions: {
        Row: {
          created_at: string | null
          id: string
          is_current: boolean | null
          release_notes: string | null
          released_at: string | null
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_current?: boolean | null
          release_notes?: string | null
          released_at?: string | null
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_current?: boolean | null
          release_notes?: string | null
          released_at?: string | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_code: string
          category: string | null
          created_at: string
          created_by: string | null
          current_value: number | null
          depreciation_rate: number | null
          description: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          org_id: string
          purchase_date: string | null
          purchase_price: number | null
          status: string
          updated_at: string
        }
        Insert: {
          asset_code: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          org_id: string
          purchase_date?: string | null
          purchase_price?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          asset_code?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          depreciation_rate?: number | null
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          purchase_date?: string | null
          purchase_price?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          billing_interval: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_seats: number | null
          metadata: Json
          name: string
          price_in_paise: number
          slug: string
          trial_period_days: number
          updated_at: string
        }
        Insert: {
          billing_interval: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_seats?: number | null
          metadata?: Json
          name: string
          price_in_paise?: number
          slug: string
          trial_period_days?: number
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_seats?: number | null
          metadata?: Json
          name?: string
          price_in_paise?: number
          slug?: string
          trial_period_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          branch_head_id: string | null
          created_at: string
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_head_id?: string | null
          created_at?: string
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_head_id?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
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
          category: string
          created_at: string | null
          hsn_code: string
          id: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          hsn_code: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          hsn_code?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_map_hsn_code_fkey"
            columns: ["hsn_code"]
            isOneToOne: false
            referencedRelation: "hsn_master"
            referencedColumns: ["hsn_code"]
          },
        ]
      }
      customers: {
        Row: {
          alias_name: string | null
          billing_address: string | null
          created_at: string | null
          created_by: string | null
          gst_number: string | null
          id: string
          master_customer_id: string
          notes: string | null
          org_id: string
          shipping_address: string | null
          state_code: string | null
          tax_status: Database["public"]["Enums"]["tax_status"] | null
          updated_at: string | null
        }
        Insert: {
          alias_name?: string | null
          billing_address?: string | null
          created_at?: string | null
          created_by?: string | null
          gst_number?: string | null
          id?: string
          master_customer_id: string
          notes?: string | null
          org_id: string
          shipping_address?: string | null
          state_code?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status"] | null
          updated_at?: string | null
        }
        Update: {
          alias_name?: string | null
          billing_address?: string | null
          created_at?: string | null
          created_by?: string | null
          gst_number?: string | null
          id?: string
          master_customer_id?: string
          notes?: string | null
          org_id?: string
          shipping_address?: string | null
          state_code?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status"] | null
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
      dc_items: {
        Row: {
          created_at: string | null
          dc_id: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          dc_id: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          dc_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dc_items_dc_id_fkey"
            columns: ["dc_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dc_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      dc_stock_ledger: {
        Row: {
          agent_user_id: string
          created_at: string | null
          created_by: string | null
          dc_id: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          sender_org_id: string
          transaction_type: string | null
        }
        Insert: {
          agent_user_id: string
          created_at?: string | null
          created_by?: string | null
          dc_id?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          sender_org_id: string
          transaction_type?: string | null
        }
        Update: {
          agent_user_id?: string
          created_at?: string | null
          created_by?: string | null
          dc_id?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          sender_org_id?: string
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dc_stock_ledger_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dc_stock_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dc_stock_ledger_dc_id_fkey"
            columns: ["dc_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dc_stock_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dc_stock_ledger_sender_org_id_fkey"
            columns: ["sender_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_challans: {
        Row: {
          accepted_date: string | null
          agent_user_id: string
          created_at: string | null
          created_by: string | null
          dc_number: string
          id: string
          issued_date: string | null
          notes: string | null
          rejected_date: string | null
          rejection_reason: string | null
          sender_org_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_date?: string | null
          agent_user_id: string
          created_at?: string | null
          created_by?: string | null
          dc_number: string
          id?: string
          issued_date?: string | null
          notes?: string | null
          rejected_date?: string | null
          rejection_reason?: string | null
          sender_org_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_date?: string | null
          agent_user_id?: string
          created_at?: string | null
          created_by?: string | null
          dc_number?: string
          id?: string
          issued_date?: string | null
          notes?: string | null
          rejected_date?: string | null
          rejection_reason?: string | null
          sender_org_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_challans_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_sender_org_id_fkey"
            columns: ["sender_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      hsn_master: {
        Row: {
          created_at: string
          description: string | null
          gst_rate: number
          gst_type: string | null
          hsn_code: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          gst_rate: number
          gst_type?: string | null
          hsn_code: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          gst_rate?: number
          gst_type?: string | null
          hsn_code?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          cost_price: number | null
          created_at: string | null
          id: string
          org_id: string
          product_id: string
          quantity: number
          selling_price: number | null
          updated_at: string | null
        }
        Insert: {
          cost_price?: number | null
          created_at?: string | null
          id?: string
          org_id: string
          product_id: string
          quantity?: number
          selling_price?: number | null
          updated_at?: string | null
        }
        Update: {
          cost_price?: number | null
          created_at?: string | null
          id?: string
          org_id?: string
          product_id?: string
          quantity?: number
          selling_price?: number | null
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
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_item_serials: {
        Row: {
          created_at: string
          id: string
          invoice_item_id: string
          serial_number: string
          status: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_item_id: string
          serial_number: string
          status?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
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
          description: string | null
          discount_amount: number | null
          gst_rate: number | null
          id: string
          invoice_id: string
          product_id: string
          quantity: number
          total_amount: number | null
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          gst_rate?: number | null
          id?: string
          invoice_id: string
          product_id: string
          quantity: number
          total_amount?: number | null
          unit: string
          unit_price: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          gst_rate?: number | null
          id?: string
          invoice_id?: string
          product_id?: string
          quantity?: number
          total_amount?: number | null
          unit?: string
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
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          agent_user_id: string | null
          branch_id: string | null
          cgst_amount: number | null
          created_at: string | null
          customer_id: string | null
          dc_id: string | null
          draft_data: Json | null
          draft_session_id: string | null
          id: string
          igst_amount: number | null
          invoice_number: string | null
          is_dc_sale: boolean
          org_id: string
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          payment_verified_at: string | null
          payment_verified_by: string | null
          sgst_amount: number | null
          status: string
          subtotal: number | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          agent_user_id?: string | null
          branch_id?: string | null
          cgst_amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          dc_id?: string | null
          draft_data?: Json | null
          draft_session_id?: string | null
          id?: string
          igst_amount?: number | null
          invoice_number?: string | null
          is_dc_sale?: boolean
          org_id: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          sgst_amount?: number | null
          status?: string
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_user_id?: string | null
          branch_id?: string | null
          cgst_amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          dc_id?: string | null
          draft_data?: Json | null
          draft_session_id?: string | null
          id?: string
          igst_amount?: number | null
          invoice_number?: string | null
          is_dc_sale?: boolean
          org_id?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          sgst_amount?: number | null
          status?: string
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "invoices_payment_verified_by_fkey"
            columns: ["payment_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      master_categories: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          gst_rate: number
          gst_type: string | null
          hsn_code: string
          id: string
          is_active: boolean
          name: string
          parent_category_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gst_rate: number
          gst_type?: string | null
          hsn_code: string
          id?: string
          is_active?: boolean
          name: string
          parent_category_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gst_rate?: number
          gst_type?: string | null
          hsn_code?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_category_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_categories_hsn_code_fkey"
            columns: ["hsn_code"]
            isOneToOne: false
            referencedRelation: "hsn_master"
            referencedColumns: ["hsn_code"]
          },
          {
            foreignKeyName: "master_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "master_categories"
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
          approval_status: string
          barcode_ean: string | null
          base_price: number | null
          base_unit: string
          category: string | null
          created_at: string | null
          created_by: string | null
          gst_rate: number | null
          gst_type: string | null
          hsn_code: string | null
          id: string
          name: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sku: string | null
          status: string
          submitted_org_id: string | null
          updated_at: string | null
        }
        Insert: {
          approval_status?: string
          barcode_ean?: string | null
          base_price?: number | null
          base_unit?: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          gst_rate?: number | null
          gst_type?: string | null
          hsn_code?: string | null
          id?: string
          name: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sku?: string | null
          status?: string
          submitted_org_id?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_status?: string
          barcode_ean?: string | null
          base_price?: number | null
          base_unit?: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          gst_rate?: number | null
          gst_type?: string | null
          hsn_code?: string | null
          id?: string
          name?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sku?: string | null
          status?: string
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
            foreignKeyName: "master_products_hsn_code_fkey"
            columns: ["hsn_code"]
            isOneToOne: false
            referencedRelation: "hsn_master"
            referencedColumns: ["hsn_code"]
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
          created_at: string
          id: string
          membership_status: string
          org_id: string
          profile_id: string
          role: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          membership_status?: string
          org_id: string
          profile_id: string
          role: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          membership_status?: string
          org_id?: string
          profile_id?: string
          role?: string
          updated_at?: string
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
          created_at: string
          id: string
          message: string
          read_at: string | null
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
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
      org_cash_settings: {
        Row: {
          created_at: string | null
          max_cash_balance: number | null
          max_cash_holding_days: number | null
          org_id: string
          require_deposit_proof: boolean | null
          require_gps_on_collection: boolean | null
          section_269st_limit: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          max_cash_balance?: number | null
          max_cash_holding_days?: number | null
          org_id: string
          require_deposit_proof?: boolean | null
          require_gps_on_collection?: boolean | null
          section_269st_limit?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          max_cash_balance?: number | null
          max_cash_holding_days?: number | null
          org_id?: string
          require_deposit_proof?: boolean | null
          require_gps_on_collection?: boolean | null
          section_269st_limit?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_cash_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          ended_at: string | null
          id: string
          metadata: Json
          org_id: string
          pending_plan_id: string | null
          plan_id: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start: string
          ended_at?: string | null
          id?: string
          metadata?: Json
          org_id: string
          pending_plan_id?: string | null
          plan_id: string
          quantity?: number
          status: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          ended_at?: string | null
          id?: string
          metadata?: Json
          org_id?: string
          pending_plan_id?: string | null
          plan_id?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_subscriptions_pending_plan_id_fkey"
            columns: ["pending_plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          address: string | null
          created_at: string
          custom_logo_url: string | null
          gst_enabled: boolean
          gst_number: string | null
          gst_verification_notes: string | null
          gst_verification_source: string | null
          gst_verification_status: string
          gst_verified_at: string | null
          gst_verified_by: string | null
          id: string
          inventory_policy: string
          legal_name: string | null
          lifecycle_state: string
          name: string
          phone: string | null
          pincode: string | null
          slug: string
          state: string
          state_code: string | null
          tax_identifier: string | null
          tax_registration_number: string | null
          tax_status: Database["public"]["Enums"]["tax_status"] | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          custom_logo_url?: string | null
          gst_enabled?: boolean
          gst_number?: string | null
          gst_verification_notes?: string | null
          gst_verification_source?: string | null
          gst_verification_status?: string
          gst_verified_at?: string | null
          gst_verified_by?: string | null
          id?: string
          inventory_policy?: string
          legal_name?: string | null
          lifecycle_state?: string
          name: string
          phone?: string | null
          pincode?: string | null
          slug: string
          state: string
          state_code?: string | null
          tax_identifier?: string | null
          tax_registration_number?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status"] | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          custom_logo_url?: string | null
          gst_enabled?: boolean
          gst_number?: string | null
          gst_verification_notes?: string | null
          gst_verification_source?: string | null
          gst_verification_status?: string
          gst_verified_at?: string | null
          gst_verified_by?: string | null
          id?: string
          inventory_policy?: string
          legal_name?: string | null
          lifecycle_state?: string
          name?: string
          phone?: string | null
          pincode?: string | null
          slug?: string
          state?: string
          state_code?: string | null
          tax_identifier?: string | null
          tax_registration_number?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orgs_gst_verified_by_fkey"
            columns: ["gst_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_serials: {
        Row: {
          created_at: string
          id: string
          org_id: string
          product_id: string
          reserved_at: string | null
          reserved_expires_at: string | null
          serial_number: string
          source_txn_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          product_id: string
          reserved_at?: string | null
          reserved_expires_at?: string | null
          serial_number: string
          source_txn_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          product_id?: string
          reserved_at?: string | null
          reserved_expires_at?: string | null
          serial_number?: string
          source_txn_id?: string | null
          status?: string
          updated_at?: string
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
          branch_id: string | null
          category: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          ean: string | null
          hsn_sac_code: string | null
          id: string
          master_product_id: string | null
          min_stock_level: number
          name: string
          org_id: string
          selling_price: number | null
          serial_tracked: boolean
          sku: string
          status: string
          tax_rate: number | null
          unit: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          category?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          ean?: string | null
          hsn_sac_code?: string | null
          id?: string
          master_product_id?: string | null
          min_stock_level?: number
          name: string
          org_id: string
          selling_price?: number | null
          serial_tracked?: boolean
          sku: string
          status?: string
          tax_rate?: number | null
          unit?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          category?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          ean?: string | null
          hsn_sac_code?: string | null
          id?: string
          master_product_id?: string | null
          min_stock_level?: number
          name?: string
          org_id?: string
          selling_price?: number | null
          serial_tracked?: boolean
          sku?: string
          status?: string
          tax_rate?: number | null
          unit?: string
          updated_at?: string
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
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "master_categories"
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
          created_at: string
          email: string
          full_name: string | null
          id: string
          platform_admin: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          platform_admin?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          platform_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      purchase_bill_items: {
        Row: {
          cost_provisional: boolean
          created_at: string
          description: string | null
          hsn_match_status: string | null
          hsn_mismatch: boolean
          id: string
          master_product_id: string | null
          product_id: string | null
          purchase_bill_id: string
          quantity: number
          system_gst_rate: number | null
          system_hsn_code: string | null
          total_amount: number
          unit: string
          unit_price: number
          vendor_gst_rate: number | null
          vendor_hsn_code: string | null
        }
        Insert: {
          cost_provisional?: boolean
          created_at?: string
          description?: string | null
          hsn_match_status?: string | null
          hsn_mismatch?: boolean
          id?: string
          master_product_id?: string | null
          product_id?: string | null
          purchase_bill_id: string
          quantity: number
          system_gst_rate?: number | null
          system_hsn_code?: string | null
          total_amount: number
          unit: string
          unit_price: number
          vendor_gst_rate?: number | null
          vendor_hsn_code?: string | null
        }
        Update: {
          cost_provisional?: boolean
          created_at?: string
          description?: string | null
          hsn_match_status?: string | null
          hsn_mismatch?: boolean
          id?: string
          master_product_id?: string | null
          product_id?: string | null
          purchase_bill_id?: string
          quantity?: number
          system_gst_rate?: number | null
          system_hsn_code?: string | null
          total_amount?: number
          unit?: string
          unit_price?: number
          vendor_gst_rate?: number | null
          vendor_hsn_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_bill_items_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_bill_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_bill_items_purchase_bill_id_fkey"
            columns: ["purchase_bill_id"]
            isOneToOne: false
            referencedRelation: "purchase_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_bills: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bill_date: string
          bill_number: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          flagged_at: string | null
          flagged_by: string | null
          flagged_reason: string | null
          id: string
          notes: string | null
          org_id: string
          posted_at: string | null
          posted_by: string | null
          status: string
          total_amount: number
          updated_at: string
          vendor_gstin: string | null
          vendor_name: string | null
          vendor_state_code: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bill_date: string
          bill_number: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          id?: string
          notes?: string | null
          org_id: string
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          total_amount: number
          updated_at?: string
          vendor_gstin?: string | null
          vendor_name?: string | null
          vendor_state_code?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bill_date?: string
          bill_number?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          vendor_gstin?: string | null
          vendor_name?: string | null
          vendor_state_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_bills_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_bills_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_bills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_bills_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_bills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_bills_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_agreement_items: {
        Row: {
          agreement_id: string
          asset_id: string
          created_at: string
          id: string
          notes: string | null
          quantity: number
          unit_rental_amount: number
        }
        Insert: {
          agreement_id: string
          asset_id: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          unit_rental_amount: number
        }
        Update: {
          agreement_id?: string
          asset_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          unit_rental_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "rental_agreement_items_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "rental_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_agreement_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_agreements: {
        Row: {
          agreement_number: string
          billing_frequency: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          end_date: string | null
          id: string
          notes: string | null
          org_id: string
          rental_amount: number
          security_deposit: number | null
          start_date: string
          status: string
          terms: string | null
          updated_at: string
        }
        Insert: {
          agreement_number: string
          billing_frequency: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          org_id: string
          rental_amount: number
          security_deposit?: number | null
          start_date: string
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Update: {
          agreement_number?: string
          billing_frequency?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          rental_amount?: number
          security_deposit?: number | null
          start_date?: string
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_agreements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_agreements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_agreements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_invoice_items: {
        Row: {
          agreement_item_id: string | null
          asset_id: string | null
          created_at: string
          description: string
          discount_amount: number | null
          gst_rate: number | null
          id: string
          invoice_id: string
          quantity: number
          total_amount: number
          unit_price: number
        }
        Insert: {
          agreement_item_id?: string | null
          asset_id?: string | null
          created_at?: string
          description: string
          discount_amount?: number | null
          gst_rate?: number | null
          id?: string
          invoice_id: string
          quantity?: number
          total_amount: number
          unit_price: number
        }
        Update: {
          agreement_item_id?: string | null
          asset_id?: string | null
          created_at?: string
          description?: string
          discount_amount?: number | null
          gst_rate?: number | null
          id?: string
          invoice_id?: string
          quantity?: number
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "rental_invoice_items_agreement_item_id_fkey"
            columns: ["agreement_item_id"]
            isOneToOne: false
            referencedRelation: "rental_agreement_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_invoice_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "rental_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_invoices: {
        Row: {
          agreement_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          org_id: string
          paid_amount: number | null
          paid_at: string | null
          payment_status: string
          period_end: string
          period_start: string
          status: string
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          agreement_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          notes?: string | null
          org_id: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_status?: string
          period_end: string
          period_start: string
          status?: string
          subtotal: number
          tax_amount?: number | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          agreement_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          org_id?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_status?: string
          period_end?: string
          period_start?: string
          status?: string
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_invoices_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "rental_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ledger: {
        Row: {
          cost_provisional: boolean
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          org_id: string
          product_id: string
          quantity: number
          transaction_type: string
        }
        Insert: {
          cost_provisional?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id: string
          product_id: string
          quantity: number
          transaction_type: string
        }
        Update: {
          cost_provisional?: boolean
          created_at?: string
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
      subscription_events: {
        Row: {
          actor_user_id: string | null
          event_time: string
          event_type: string
          id: string
          org_subscription_id: string
          payload: Json
        }
        Insert: {
          actor_user_id?: string | null
          event_time?: string
          event_type: string
          id?: string
          org_subscription_id: string
          payload?: Json
        }
        Update: {
          actor_user_id?: string | null
          event_time?: string
          event_type?: string
          id?: string
          org_subscription_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_org_subscription_id_fkey"
            columns: ["org_subscription_id"]
            isOneToOne: false
            referencedRelation: "org_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_org_contexts: {
        Row: {
          org_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          org_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          org_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_org_contexts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_org_contexts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock_level: {
        Args: {
          p_delta_qty: number
          p_notes: string
          p_org_id: string
          p_product_id: string
        }
        Returns: Json
      }
      approve_purchase_bill_with_hsn_validation: {
        Args: { p_bill_id: string; p_org_id: string; p_user_id: string }
        Returns: Json
      }
      check_hsn_mismatch: {
        Args: { p_product_id: string; p_vendor_hsn_code: string }
        Returns: {
          matches: boolean
          system_gst_rate: number
          system_hsn_code: string
          vendor_hsn_code: string
        }[]
      }
      check_platform_admin_email: {
        Args: { p_email: string }
        Returns: boolean
      }
      check_user_has_password: { Args: never; Returns: boolean }
      create_default_org_for_user: { Args: never; Returns: Json }
      create_rental_agreement: {
        Args: {
          p_agreement_number: string
          p_asset_items: Json
          p_billing_frequency: string
          p_customer_id: string
          p_end_date: string
          p_notes?: string
          p_rental_amount: number
          p_security_deposit?: number
          p_start_date: string
          p_terms?: string
        }
        Returns: Json
      }
      current_user_branch_id: { Args: never; Returns: string }
      current_user_branch_ids: { Args: never; Returns: string[] }
      current_user_is_agent_for_org: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      current_user_is_agent_for_relationship: {
        Args: { p_relationship_id: string }
        Returns: boolean
      }
      current_user_is_helper_for_org: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      current_user_is_helper_for_relationship: {
        Args: { p_relationship_id: string }
        Returns: boolean
      }
      current_user_is_platform_admin: { Args: never; Returns: boolean }
      current_user_is_sender_owner_for_relationship: {
        Args: { p_relationship_id: string }
        Returns: boolean
      }
      current_user_org_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      exceeds_cash_limit: {
        Args: { p_agent_user_id: string; p_sender_org_id: string }
        Returns: boolean
      }
      get_agent_cash_on_hand: {
        Args: { p_agent_user_id: string; p_sender_org_id: string }
        Returns: number
      }
      get_dc_stock_summary: {
        Args: { p_agent_user_id: string; p_sender_org_id: string }
        Returns: {
          current_stock: number
          product_id: string
          product_name: string
          product_sku: string
        }[]
      }
      has_overdue_cash: {
        Args: { p_agent_user_id: string; p_sender_org_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      lookup_product_code: {
        Args: { p_code: string; p_org_id: string }
        Returns: {
          category_id: string
          category_name: string
          found: boolean
          gst_rate: number
          hsn_code: string
          lookup_type: string
          master_product_id: string
          product_id: string
          product_name: string
          product_sku: string
          selling_price: number
        }[]
      }
      lookup_serial_number: {
        Args: { p_org_id: string; p_serial_number: string }
        Returns: {
          found: boolean
          gst_rate: number
          hsn_code: string
          lookup_type: string
          product_id: string
          product_name: string
          product_sku: string
          selling_price: number
        }[]
      }
      mark_gst_verified:
        | {
            Args: {
              p_address?: string
              p_legal_name?: string
              p_org_id: string
              p_verification_notes: string
            }
            Returns: undefined
          }
        | {
            Args: { p_org_id: string; p_verification_notes: string }
            Returns: undefined
          }
      post_purchase_bill: {
        Args: { p_bill_id: string; p_org_id: string; p_user_id: string }
        Returns: Json
      }
      post_sales_invoice: {
        Args: { p_invoice_id: string; p_org_id: string; p_user_id: string }
        Returns: Json
      }
      set_current_org_context: {
        Args: { p_org_id?: string }
        Returns: undefined
      }
      set_gst_from_validation: {
        Args: {
          p_gst_enabled: boolean
          p_gst_number: string
          p_org_id: string
          p_verification_source: string
          p_verification_status: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      terminate_rental_agreement: {
        Args: { p_agreement_id: string; p_new_status: string }
        Returns: Json
      }
      test_auth_uid: { Args: never; Returns: Json }
      test_post_purchase_bill_atomicity: {
        Args: {
          p_failure_scenario: string
          p_test_bill_id: string
          p_test_org_id: string
          p_test_user_id: string
        }
        Returns: Json
      }
      test_rpc_security: {
        Args: never
        Returns: {
          error_message: string
          passed: boolean
          test_name: string
        }[]
      }
      test_rpc_security_direct: {
        Args: never
        Returns: {
          details: string
          error_message: string
          passed: boolean
          test_name: string
        }[]
      }
      test_rpc_security_with_user_context: {
        Args: never
        Returns: {
          details: string
          error_message: string
          passed: boolean
          test_name: string
        }[]
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
    }
    Enums: {
      tax_status:
        | "registered_regular"
        | "registered_composition"
        | "unregistered"
        | "consumer"
        | "sez_unit"
        | "sez_developer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      tax_status: [
        "registered_regular",
        "registered_composition",
        "unregistered",
        "consumer",
        "sez_unit",
        "sez_developer",
      ],
    },
  },
} as const
