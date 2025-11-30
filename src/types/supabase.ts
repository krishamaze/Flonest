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
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_cash_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
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
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_cash_ledger_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_invites: {
        Row: {
          created_at: string | null
          created_by: string
          email: string | null
          expires_at: string | null
          id: string
          invite_code: string
          org_id: string
          phone: string | null
          status: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          email?: string | null
          expires_at?: string | null
          id?: string
          invite_code: string
          org_id: string
          phone?: string | null
          status?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          invite_code?: string
          org_id?: string
          phone?: string | null
          status?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_org_relationships: {
        Row: {
          agent_user_id: string
          created_at: string | null
          id: string
          invited_by: string | null
          org_id: string
          status: string | null
        }
        Insert: {
          agent_user_id: string
          created_at?: string | null
          id?: string
          invited_by?: string | null
          org_id: string
          status?: string | null
        }
        Update: {
          agent_user_id?: string
          created_at?: string | null
          id?: string
          invited_by?: string | null
          org_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_org_relationships_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_org_relationships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_org_relationships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          gstin: string | null
          id: string
          name: string
          org_id: string
          phone: string | null
          pincode: string | null
          state: string | null
          tax_status: Database["public"]["Enums"]["tax_status"] | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          name: string
          org_id: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status"] | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          name?: string
          org_id?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          hsn_code: string | null
          id: string
          invoice_id: string
          item_name: string
          price_per_unit: number
          product_id: string | null
          quantity: number
          tax_amount: number | null
          tax_percent: number | null
          total_amount: number
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id: string
          item_name: string
          price_per_unit: number
          product_id?: string | null
          quantity: number
          tax_amount?: number | null
          tax_percent?: number | null
          total_amount: number
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id?: string
          item_name?: string
          price_per_unit?: number
          product_id?: string | null
          quantity?: number
          tax_amount?: number | null
          tax_percent?: number | null
          total_amount?: number
          unit?: string | null
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
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          discount_amount: number | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          org_id: string
          payment_status: string | null
          status: string | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          notes?: string | null
          org_id: string
          payment_status?: string | null
          status?: string | null
          subtotal: number
          tax_amount?: number | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          org_id?: string
          payment_status?: string | null
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
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
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      master_products: {
        Row: {
          category: string | null
          created_at: string | null
          hsn_code: string
          id: string
          name: string
          tax_percent: number | null
          unit: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          hsn_code: string
          id?: string
          name: string
          tax_percent?: number | null
          unit?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          hsn_code?: string
          id?: string
          name?: string
          tax_percent?: number | null
          unit?: string | null
        }
        Relationships: []
      }
      org_invites: {
        Row: {
          created_at: string | null
          created_by: string
          email: string | null
          expires_at: string | null
          id: string
          invite_code: string
          org_id: string
          phone: string | null
          role: string | null
          status: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          email?: string | null
          expires_at?: string | null
          id?: string
          invite_code: string
          org_id: string
          phone?: string | null
          role?: string | null
          status?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          invite_code?: string
          org_id?: string
          phone?: string | null
          role?: string | null
          status?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          gstin: string | null
          id: string
          name: string
          phone: string | null
          pincode: string | null
          state: string | null
          tax_status: Database["public"]["Enums"]["tax_status"] | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          name: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status"] | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          name?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string | null
          created_by: string | null
          hsn_code: string | null
          id: string
          master_product_id: string | null
          name: string
          org_id: string
          price: number | null
          tax_percent: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          hsn_code?: string | null
          id?: string
          master_product_id?: string | null
          name: string
          org_id: string
          price?: number | null
          tax_percent?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          hsn_code?: string | null
          id?: string
          master_product_id?: string | null
          name?: string
          org_id?: string
          price?: number | null
          tax_percent?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
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
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_org_roles: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_org_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_org_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_customer_and_get_id: {
        Args: {
          p_name: string
          p_org_id: string
          p_created_by: string
          p_phone?: string
          p_email?: string
          p_gstin?: string
          p_tax_status?: Database["public"]["Enums"]["tax_status"]
          p_address_line1?: string
          p_address_line2?: string
          p_city?: string
          p_state?: string
          p_pincode?: string
          p_country?: string
        }
        Returns: string
      }
      create_invoice_with_items: {
        Args: {
          p_org_id: string
          p_created_by: string
          p_customer_id?: string
          p_invoice_number: string
          p_invoice_date: string
          p_due_date?: string
          p_subtotal: number
          p_tax_amount?: number
          p_discount_amount?: number
          p_total_amount: number
          p_notes?: string
          p_status?: string
          p_payment_status?: string
          p_items: Json
        }
        Returns: string
      }
      create_organization_and_assign_role: {
        Args: {
          p_user_id: string
          p_org_name: string
          p_org_phone?: string
          p_org_email?: string
          p_org_gstin?: string
          p_org_tax_status?: Database["public"]["Enums"]["tax_status"]
          p_org_address_line1?: string
          p_org_address_line2?: string
          p_org_city?: string
          p_org_state?: string
          p_org_pincode?: string
          p_org_country?: string
          p_role?: string
        }
        Returns: string
      }
      create_product_and_get_id: {
        Args: {
          p_name: string
          p_org_id: string
          p_created_by: string
          p_hsn_code?: string
          p_price?: number
          p_tax_percent?: number
          p_unit?: string
          p_master_product_id?: string
        }
        Returns: string
      }
      get_user_organizations: {
        Args: {
          p_user_id: string
        }
        Returns: {
          org_id: string
          org_name: string
          role: string
          org_created_at: string
        }[]
      }
      search_customers_by_name: {
        Args: {
          p_org_id: string
          p_search_term: string
          p_limit?: number
        }
        Returns: {
          id: string
          name: string
          phone: string
          email: string
          gstin: string
          tax_status: Database["public"]["Enums"]["tax_status"]
          address_line1: string
          address_line2: string
          city: string
          state: string
          pincode: string
          country: string
          last_invoice_date: string
        }[]
      }
      search_master_products: {
        Args: {
          p_search_term: string
          p_limit?: number
        }
        Returns: {
          id: string
          name: string
          hsn_code: string
          category: string
          tax_percent: number
          unit: string
        }[]
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

type DefaultSchema = Database["public"]

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
