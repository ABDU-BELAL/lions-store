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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          sort_order: number
          title: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          title?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          title?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string
          description_en: string | null
          id: string
          image_url: string | null
          is_active: boolean
          parent_id: string | null
          show_on_home: boolean
          slug: string
          sort_order: number
          title: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          parent_id?: string | null
          show_on_home?: boolean
          slug: string
          sort_order?: number
          title: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          parent_id?: string | null
          show_on_home?: boolean
          slug?: string
          sort_order?: number
          title?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          created_at: string
          game_user_id: string | null
          id: string
          product_id: string | null
          product_title: string
          provider: string | null
          provider_attempts: number
          provider_last_checked_at: string | null
          provider_order_id: string | null
          provider_reply: Json | null
          provider_started_at: string | null
          provider_status: string | null
          provider_uuid: string | null
          quantity: number | null
          refund_reason: string | null
          refunded: boolean
          refunded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          game_user_id?: string | null
          id?: string
          product_id?: string | null
          product_title: string
          provider?: string | null
          provider_attempts?: number
          provider_last_checked_at?: string | null
          provider_order_id?: string | null
          provider_reply?: Json | null
          provider_started_at?: string | null
          provider_status?: string | null
          provider_uuid?: string | null
          quantity?: number | null
          refund_reason?: string | null
          refunded?: boolean
          refunded_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          game_user_id?: string | null
          id?: string
          product_id?: string | null
          product_title?: string
          provider?: string | null
          provider_attempts?: number
          provider_last_checked_at?: string | null
          provider_order_id?: string | null
          provider_reply?: Json | null
          provider_started_at?: string | null
          provider_status?: string | null
          provider_uuid?: string | null
          quantity?: number | null
          refund_reason?: string | null
          refunded?: boolean
          refunded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          auto_fulfill_enabled: boolean
          category: string
          collection_id: string | null
          created_at: string
          description: string | null
          description_en: string | null
          id: string
          image_url: string | null
          in_stock: boolean
          is_active: boolean
          is_offer: boolean
          max_quantity: number | null
          min_quantity: number | null
          price: number
          provider: string | null
          provider_product_id: string | null
          purchase_field_mode: string
          quantity_enabled: boolean
          sort_order: number
          title: string
          title_en: string | null
          unit_label: string | null
          unit_size: number
          updated_at: string
        }
        Insert: {
          auto_fulfill_enabled?: boolean
          category?: string
          collection_id?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          is_active?: boolean
          is_offer?: boolean
          max_quantity?: number | null
          min_quantity?: number | null
          price: number
          provider?: string | null
          provider_product_id?: string | null
          purchase_field_mode?: string
          quantity_enabled?: boolean
          sort_order?: number
          title: string
          title_en?: string | null
          unit_label?: string | null
          unit_size?: number
          updated_at?: string
        }
        Update: {
          auto_fulfill_enabled?: boolean
          category?: string
          collection_id?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          is_active?: boolean
          is_offer?: boolean
          max_quantity?: number | null
          min_quantity?: number | null
          price?: number
          provider?: string | null
          provider_product_id?: string | null
          purchase_field_mode?: string
          quantity_enabled?: boolean
          sort_order?: number
          title?: string
          title_en?: string | null
          unit_label?: string | null
          unit_size?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          custom_id: string | null
          email: string | null
          full_name: string
          id: string
          is_banned: boolean
          lifetime_spend: number
          notified_at: string | null
          phone: string
          updated_at: string
          vip_assigned_at: string | null
          vip_assigned_by: string | null
          vip_level: number
        }
        Insert: {
          created_at?: string
          custom_id?: string | null
          email?: string | null
          full_name?: string
          id: string
          is_banned?: boolean
          lifetime_spend?: number
          notified_at?: string | null
          phone?: string
          updated_at?: string
          vip_assigned_at?: string | null
          vip_assigned_by?: string | null
          vip_level?: number
        }
        Update: {
          created_at?: string
          custom_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_banned?: boolean
          lifetime_spend?: number
          notified_at?: string | null
          phone?: string
          updated_at?: string
          vip_assigned_at?: string | null
          vip_assigned_by?: string | null
          vip_level?: number
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          id: string
          key: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      telegram_chats: {
        Row: {
          added_at: string
          chat_id: string
          enabled: boolean
          title: string | null
        }
        Insert: {
          added_at?: string
          chat_id: string
          enabled?: boolean
          title?: string | null
        }
        Update: {
          added_at?: string
          chat_id?: string
          enabled?: boolean
          title?: string | null
        }
        Relationships: []
      }
      topup_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          processed_at: string | null
          processed_by: string | null
          reference: string
          screenshot_path: string | null
          status: Database["public"]["Enums"]["topup_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reference?: string
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["topup_status"]
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reference?: string
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["topup_status"]
          user_id?: string
        }
        Relationships: []
      }
      user_discounts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          percent: number
          product_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          percent: number
          product_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          percent?: number
          product_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_discounts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vip_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          meta: Json | null
          new_level: number | null
          old_level: number | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          new_level?: number | null
          old_level?: number | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          new_level?: number | null
          old_level?: number | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      vip_tiers: {
        Row: {
          accent_hex: string
          badge_url: string | null
          color_hex: string
          discount_percent: number
          level: number
          name_ar: string
          name_en: string
          spend_threshold: number
          updated_at: string
          usd_spend_threshold: number
        }
        Insert: {
          accent_hex?: string
          badge_url?: string | null
          color_hex?: string
          discount_percent?: number
          level: number
          name_ar: string
          name_en: string
          spend_threshold?: number
          updated_at?: string
          usd_spend_threshold?: number
        }
        Update: {
          accent_hex?: string
          badge_url?: string | null
          color_hex?: string
          discount_percent?: number
          level?: number
          name_ar?: string
          name_en?: string
          spend_threshold?: number
          updated_at?: string
          usd_spend_threshold?: number
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          ref_id: string | null
          ref_table: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          ref_id?: string | null
          ref_table?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          ref_id?: string | null
          ref_table?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_assign_vip: {
        Args: { p_level: number; p_target: string }
        Returns: undefined
      }
      admin_revoke_vip: { Args: { p_target: string }; Returns: undefined }
      admin_update_vip_tier: {
        Args: {
          p_accent_hex?: string
          p_badge_url?: string
          p_color_hex?: string
          p_discount_percent?: number
          p_level: number
          p_name_ar?: string
          p_name_en?: string
          p_spend_threshold?: number
          p_usd_spend_threshold?: number
        }
        Returns: undefined
      }
      credit_wallet: {
        Args: {
          p_amount: number
          p_description: string
          p_ref_id: string
          p_ref_table: string
          p_type: string
          p_user_id: string
        }
        Returns: number
      }
      gen_custom_id: { Args: never; Returns: string }
      get_effective_discount: {
        Args: { p_product_id: string; p_user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_banned: { Args: { _user_id: string }; Returns: boolean }
      process_purchase: {
        Args: {
          p_game_user_id?: string
          p_product_id: string
          p_quantity?: number
          p_user_id: string
        }
        Returns: string
      }
      purchase_product: {
        Args: { p_game_user_id?: string; p_product_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "super_admin" | "user"
      payment_method: "vodafone_cash" | "instapay" | "fawry" | "binance"
      topup_status: "pending" | "approved" | "rejected"
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
    Enums: {
      app_role: ["admin", "super_admin", "user"],
      payment_method: ["vodafone_cash", "instapay", "fawry", "binance"],
      topup_status: ["pending", "approved", "rejected"],
    },
  },
} as const
