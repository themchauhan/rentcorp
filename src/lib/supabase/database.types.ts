export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          id: number;
          metadata: NonNullable<Json>;
          target_id: string | null;
          target_type: string | null;
          tenant_id: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: never;
          metadata?: NonNullable<Json>;
          target_id?: string | null;
          target_type?: string | null;
          tenant_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: never;
          metadata?: NonNullable<Json>;
          target_id?: string | null;
          target_type?: string | null;
          tenant_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      message_log: {
        Row: {
          amount_due_snapshot_paise: number | null;
          body_snapshot: string;
          channel: Database["public"]["Enums"]["message_log_channel"];
          id: number;
          message_type: Database["public"]["Enums"]["message_type"];
          opened_at: string;
          rental_order_id: string;
          sent_by: string | null;
          tenant_id: string;
          to_number: string | null;
        };
        Insert: {
          amount_due_snapshot_paise?: number | null;
          body_snapshot: string;
          channel: Database["public"]["Enums"]["message_log_channel"];
          id?: never;
          message_type: Database["public"]["Enums"]["message_type"];
          opened_at?: string;
          rental_order_id: string;
          sent_by?: string | null;
          tenant_id?: string;
          to_number?: string | null;
        };
        Update: {
          amount_due_snapshot_paise?: number | null;
          body_snapshot?: string;
          channel?: Database["public"]["Enums"]["message_log_channel"];
          id?: never;
          message_type?: Database["public"]["Enums"]["message_type"];
          opened_at?: string;
          rental_order_id?: string;
          sent_by?: string | null;
          tenant_id?: string;
          to_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_log_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_log_tenant_id_rental_order_id_fkey";
            columns: ["tenant_id", "rental_order_id"];
            isOneToOne: false;
            referencedRelation: "rental_orders";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      message_templates: {
        Row: {
          body: string;
          message_type: Database["public"]["Enums"]["message_type"];
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          body: string;
          message_type: Database["public"]["Enums"]["message_type"];
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          body?: string;
          message_type?: Database["public"]["Enums"]["message_type"];
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_templates_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          name: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          name: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          mobile: string;
          must_change_password: boolean;
          name: string;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["profile_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          mobile: string;
          must_change_password?: boolean;
          name: string;
          role: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["profile_status"];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mobile?: string;
          must_change_password?: boolean;
          name?: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["profile_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_customers: {
        Row: {
          address: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          mobile: string;
          name: string;
          preferred_channel: Database["public"]["Enums"]["message_channel"];
          tenant_id: string;
          updated_at: string;
          whatsapp_number: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mobile: string;
          name: string;
          preferred_channel?: Database["public"]["Enums"]["message_channel"];
          tenant_id?: string;
          updated_at?: string;
          whatsapp_number?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mobile?: string;
          name?: string;
          preferred_channel?: Database["public"]["Enums"]["message_channel"];
          tenant_id?: string;
          updated_at?: string;
          whatsapp_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "rental_customers_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_items: {
        Row: {
          active: boolean;
          category: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          rate_paise: number;
          rate_unit: Database["public"]["Enums"]["rate_unit"];
          tenant_id: string;
          total_quantity_owned: number;
          unit_label: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          category: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          rate_paise: number;
          rate_unit: Database["public"]["Enums"]["rate_unit"];
          tenant_id?: string;
          total_quantity_owned: number;
          unit_label?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          rate_paise?: number;
          rate_unit?: Database["public"]["Enums"]["rate_unit"];
          tenant_id?: string;
          total_quantity_owned?: number;
          unit_label?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_order_items: {
        Row: {
          created_at: string;
          id: string;
          item_name_snapshot: string;
          quantity: number;
          rate_paise_snapshot: number;
          rate_unit_snapshot: Database["public"]["Enums"]["rate_unit"];
          rental_item_id: string;
          rental_order_id: string;
          tenant_id: string;
          unit_label_snapshot: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_name_snapshot: string;
          quantity: number;
          rate_paise_snapshot: number;
          rate_unit_snapshot: Database["public"]["Enums"]["rate_unit"];
          rental_item_id: string;
          rental_order_id: string;
          tenant_id?: string;
          unit_label_snapshot: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_name_snapshot?: string;
          quantity?: number;
          rate_paise_snapshot?: number;
          rate_unit_snapshot?: Database["public"]["Enums"]["rate_unit"];
          rental_item_id?: string;
          rental_order_id?: string;
          tenant_id?: string;
          unit_label_snapshot?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_order_items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_order_items_tenant_id_rental_item_id_fkey";
            columns: ["tenant_id", "rental_item_id"];
            isOneToOne: false;
            referencedRelation: "rental_items";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "rental_order_items_tenant_id_rental_order_id_fkey";
            columns: ["tenant_id", "rental_order_id"];
            isOneToOne: false;
            referencedRelation: "rental_orders";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      rental_orders: {
        Row: {
          booking_number: number;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          discount_reason: string | null;
          discount_type: Database["public"]["Enums"]["discount_type"];
          discount_updated_at: string | null;
          discount_updated_by: string | null;
          discount_value: number;
          event_start_date: string;
          event_start_time: string | null;
          expected_return_date: string;
          id: string;
          notes: string | null;
          order_date: string;
          security_deposit_paise: number | null;
          status: Database["public"]["Enums"]["booking_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          booking_number: number;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          discount_reason?: string | null;
          discount_type?: Database["public"]["Enums"]["discount_type"];
          discount_updated_at?: string | null;
          discount_updated_by?: string | null;
          discount_value?: number;
          event_start_date: string;
          event_start_time?: string | null;
          expected_return_date: string;
          id?: string;
          notes?: string | null;
          order_date?: string;
          security_deposit_paise?: number | null;
          status?: Database["public"]["Enums"]["booking_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          booking_number?: number;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          discount_reason?: string | null;
          discount_type?: Database["public"]["Enums"]["discount_type"];
          discount_updated_at?: string | null;
          discount_updated_by?: string | null;
          discount_value?: number;
          event_start_date?: string;
          event_start_time?: string | null;
          expected_return_date?: string;
          id?: string;
          notes?: string | null;
          order_date?: string;
          security_deposit_paise?: number | null;
          status?: Database["public"]["Enums"]["booking_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_orders_tenant_id_customer_id_fkey";
            columns: ["tenant_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "rental_orders_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
          plan: string | null;
          status: Database["public"]["Enums"]["tenant_status"];
          subscription_ends_at: string | null;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          plan?: string | null;
          status?: Database["public"]["Enums"]["tenant_status"];
          subscription_ends_at?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          plan?: string | null;
          status?: Database["public"]["Enums"]["tenant_status"];
          subscription_ends_at?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_booking: {
        Args: {
          p_customer_id: string;
          p_discount_reason?: string;
          p_discount_type?: Database["public"]["Enums"]["discount_type"];
          p_discount_value?: number;
          p_event_start_date: string;
          p_event_start_time?: string;
          p_expected_return_date: string;
          p_lines: Json;
          p_notes?: string;
          p_security_deposit_paise?: number;
        };
        Returns: string;
      };
      item_commitments: {
        Args: { p_end: string; p_start: string };
        Returns: {
          committed: number;
          rental_item_id: string;
        }[];
      };
      mark_password_changed: { Args: Record<PropertyKey, never>; Returns: undefined };
      provision_tenant_with_owner: {
        Args: {
          p_owner_id: string;
          p_owner_mobile: string;
          p_owner_name: string;
          p_tenant_name: string;
          p_tenant_phone?: string;
          p_trial_days?: number;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "SUPER_ADMIN" | "ADMIN" | "STAFF";
      booking_status: "ACTIVE" | "PARTIALLY_RETURNED" | "RETURNED" | "OVERDUE" | "CANCELLED";
      discount_type: "NONE" | "FLAT" | "PERCENT";
      message_channel: "WHATSAPP" | "SMS";
      message_log_channel: "WHATSAPP" | "SMS" | "COPY";
      message_type: "BOOKING_CONFIRMATION" | "AMOUNT_DUE" | "RETURN_CONFIRMATION";
      profile_status: "ACTIVE" | "INACTIVE";
      rate_unit: "PER_DAY" | "PER_EVENT";
      tenant_status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["SUPER_ADMIN", "ADMIN", "STAFF"],
      booking_status: ["ACTIVE", "PARTIALLY_RETURNED", "RETURNED", "OVERDUE", "CANCELLED"],
      discount_type: ["NONE", "FLAT", "PERCENT"],
      message_channel: ["WHATSAPP", "SMS"],
      message_log_channel: ["WHATSAPP", "SMS", "COPY"],
      message_type: ["BOOKING_CONFIRMATION", "AMOUNT_DUE", "RETURN_CONFIRMATION"],
      profile_status: ["ACTIVE", "INACTIVE"],
      rate_unit: ["PER_DAY", "PER_EVENT"],
      tenant_status: ["TRIAL", "ACTIVE", "SUSPENDED", "EXPIRED"],
    },
  },
} as const;
