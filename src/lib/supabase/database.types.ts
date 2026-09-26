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
      profile_status: ["ACTIVE", "INACTIVE"],
      rate_unit: ["PER_DAY", "PER_EVENT"],
      tenant_status: ["TRIAL", "ACTIVE", "SUSPENDED", "EXPIRED"],
    },
  },
} as const;
