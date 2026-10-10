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
      job_runs: {
        Row: {
          businesses: number;
          errors: NonNullable<Json>;
          failed: number;
          finished_at: string | null;
          id: number;
          job: string;
          run_date: string;
          sent: number;
          skipped: number;
          started_at: string;
        };
        Insert: {
          businesses?: number;
          errors?: NonNullable<Json>;
          failed?: number;
          finished_at?: string | null;
          id?: never;
          job: string;
          run_date: string;
          sent?: number;
          skipped?: number;
          started_at?: string;
        };
        Update: {
          businesses?: number;
          errors?: NonNullable<Json>;
          failed?: number;
          finished_at?: string | null;
          id?: never;
          job?: string;
          run_date?: string;
          sent?: number;
          skipped?: number;
          started_at?: string;
        };
        Relationships: [];
      };
      message_log: {
        Row: {
          amount_due_snapshot_paise: number | null;
          body_snapshot: string;
          channel: Database["public"]["Enums"]["message_log_channel"];
          delivery_status: Database["public"]["Enums"]["whatsapp_delivery_status"] | null;
          error_code: string | null;
          error_message: string | null;
          id: number;
          message_type: Database["public"]["Enums"]["message_type"];
          opened_at: string;
          pg_stay_id: string | null;
          provider_message_id: string | null;
          reminder_date: string | null;
          rental_order_id: string | null;
          sent_by: string | null;
          status_updated_at: string | null;
          template_name: string | null;
          tenant_id: string;
          to_number: string | null;
        };
        Insert: {
          amount_due_snapshot_paise?: number | null;
          body_snapshot: string;
          channel: Database["public"]["Enums"]["message_log_channel"];
          delivery_status?: Database["public"]["Enums"]["whatsapp_delivery_status"] | null;
          error_code?: string | null;
          error_message?: string | null;
          id?: never;
          message_type: Database["public"]["Enums"]["message_type"];
          opened_at?: string;
          pg_stay_id?: string | null;
          provider_message_id?: string | null;
          reminder_date?: string | null;
          rental_order_id?: string | null;
          sent_by?: string | null;
          status_updated_at?: string | null;
          template_name?: string | null;
          tenant_id?: string;
          to_number?: string | null;
        };
        Update: {
          amount_due_snapshot_paise?: number | null;
          body_snapshot?: string;
          channel?: Database["public"]["Enums"]["message_log_channel"];
          delivery_status?: Database["public"]["Enums"]["whatsapp_delivery_status"] | null;
          error_code?: string | null;
          error_message?: string | null;
          id?: never;
          message_type?: Database["public"]["Enums"]["message_type"];
          opened_at?: string;
          pg_stay_id?: string | null;
          provider_message_id?: string | null;
          reminder_date?: string | null;
          rental_order_id?: string | null;
          sent_by?: string | null;
          status_updated_at?: string | null;
          template_name?: string | null;
          tenant_id?: string;
          to_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_log_stay_fkey";
            columns: ["tenant_id", "pg_stay_id"];
            isOneToOne: false;
            referencedRelation: "pg_stays";
            referencedColumns: ["tenant_id", "id"];
          },
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
      pg_agreements: {
        Row: {
          created_at: string;
          created_by: string | null;
          document_path: string | null;
          document_size: number | null;
          document_type: string | null;
          document_uploaded_at: string | null;
          end_date: string;
          id: string;
          lock_in_until: string | null;
          renewed_from: string | null;
          rent_increase_pct: number;
          start_date: string;
          status: Database["public"]["Enums"]["pg_agreement_status"];
          stay_id: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          document_path?: string | null;
          document_size?: number | null;
          document_type?: string | null;
          document_uploaded_at?: string | null;
          end_date: string;
          id?: string;
          lock_in_until?: string | null;
          renewed_from?: string | null;
          rent_increase_pct?: number;
          start_date: string;
          status?: Database["public"]["Enums"]["pg_agreement_status"];
          stay_id: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          document_path?: string | null;
          document_size?: number | null;
          document_type?: string | null;
          document_uploaded_at?: string | null;
          end_date?: string;
          id?: string;
          lock_in_until?: string | null;
          renewed_from?: string | null;
          rent_increase_pct?: number;
          start_date?: string;
          status?: Database["public"]["Enums"]["pg_agreement_status"];
          stay_id?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pg_agreements_renewed_from_fkey";
            columns: ["renewed_from"];
            isOneToOne: false;
            referencedRelation: "pg_agreements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pg_agreements_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pg_agreements_tenant_id_stay_id_fkey";
            columns: ["tenant_id", "stay_id"];
            isOneToOne: false;
            referencedRelation: "pg_stays";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      pg_beds: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          label: string;
          room_id: string;
          tenant_id: string;
          under_maintenance: boolean;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          label: string;
          room_id: string;
          tenant_id?: string;
          under_maintenance?: boolean;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          label?: string;
          room_id?: string;
          tenant_id?: string;
          under_maintenance?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pg_beds_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pg_beds_tenant_id_room_id_fkey";
            columns: ["tenant_id", "room_id"];
            isOneToOne: false;
            referencedRelation: "pg_rooms";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      pg_complaints: {
        Row: {
          category: Database["public"]["Enums"]["pg_complaint_category"];
          description: string;
          id: string;
          priority: Database["public"]["Enums"]["pg_complaint_priority"];
          raised_at: string;
          raised_by: string | null;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          room_id: string | null;
          status: Database["public"]["Enums"]["pg_complaint_status"];
          stay_id: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          category: Database["public"]["Enums"]["pg_complaint_category"];
          description: string;
          id?: string;
          priority?: Database["public"]["Enums"]["pg_complaint_priority"];
          raised_at?: string;
          raised_by?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          room_id?: string | null;
          status?: Database["public"]["Enums"]["pg_complaint_status"];
          stay_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["pg_complaint_category"];
          description?: string;
          id?: string;
          priority?: Database["public"]["Enums"]["pg_complaint_priority"];
          raised_at?: string;
          raised_by?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          room_id?: string | null;
          status?: Database["public"]["Enums"]["pg_complaint_status"];
          stay_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pg_complaints_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pg_complaints_tenant_id_room_id_fkey";
            columns: ["tenant_id", "room_id"];
            isOneToOne: false;
            referencedRelation: "pg_rooms";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "pg_complaints_tenant_id_stay_id_fkey";
            columns: ["tenant_id", "stay_id"];
            isOneToOne: false;
            referencedRelation: "pg_stays";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      pg_id_documents: {
        Row: {
          content_type: string;
          customer_id: string;
          doc_type: Database["public"]["Enums"]["pg_id_type"];
          id: string;
          removed_at: string | null;
          removed_by: string | null;
          side: Database["public"]["Enums"]["pg_id_side"];
          size_bytes: number;
          storage_path: string;
          tenant_id: string;
          uploaded_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          content_type: string;
          customer_id: string;
          doc_type: Database["public"]["Enums"]["pg_id_type"];
          id?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          side?: Database["public"]["Enums"]["pg_id_side"];
          size_bytes: number;
          storage_path: string;
          tenant_id?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          content_type?: string;
          customer_id?: string;
          doc_type?: Database["public"]["Enums"]["pg_id_type"];
          id?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          side?: Database["public"]["Enums"]["pg_id_side"];
          size_bytes?: number;
          storage_path?: string;
          tenant_id?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pg_id_documents_tenant_id_customer_id_fkey";
            columns: ["tenant_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "pg_id_documents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      pg_meal_plans: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          monthly_paise: number;
          name: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          monthly_paise: number;
          name: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          monthly_paise?: number;
          name?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pg_meal_plans_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      pg_payments: {
        Row: {
          amount_paise: number;
          id: string;
          kind: Database["public"]["Enums"]["payment_kind"];
          mode: Database["public"]["Enums"]["payment_mode"];
          note: string | null;
          purpose: Database["public"]["Enums"]["pg_payment_purpose"];
          received_at: string;
          received_by: string | null;
          reverses_payment_id: string | null;
          stay_id: string;
          tenant_id: string;
        };
        Insert: {
          amount_paise: number;
          id?: string;
          kind?: Database["public"]["Enums"]["payment_kind"];
          mode: Database["public"]["Enums"]["payment_mode"];
          note?: string | null;
          purpose: Database["public"]["Enums"]["pg_payment_purpose"];
          received_at?: string;
          received_by?: string | null;
          reverses_payment_id?: string | null;
          stay_id: string;
          tenant_id?: string;
        };
        Update: {
          amount_paise?: number;
          id?: string;
          kind?: Database["public"]["Enums"]["payment_kind"];
          mode?: Database["public"]["Enums"]["payment_mode"];
          note?: string | null;
          purpose?: Database["public"]["Enums"]["pg_payment_purpose"];
          received_at?: string;
          received_by?: string | null;
          reverses_payment_id?: string | null;
          stay_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pg_payments_reverses_payment_id_fkey";
            columns: ["reverses_payment_id"];
            isOneToOne: true;
            referencedRelation: "pg_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pg_payments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pg_payments_tenant_id_stay_id_fkey";
            columns: ["tenant_id", "stay_id"];
            isOneToOne: false;
            referencedRelation: "pg_stays";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      pg_resident_details: {
        Row: {
          customer_id: string;
          emergency_mobile: string | null;
          emergency_name: string | null;
          id_type: Database["public"]["Enums"]["pg_id_type"] | null;
          occupation: string | null;
          permanent_address: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          customer_id: string;
          emergency_mobile?: string | null;
          emergency_name?: string | null;
          id_type?: Database["public"]["Enums"]["pg_id_type"] | null;
          occupation?: string | null;
          permanent_address?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          customer_id?: string;
          emergency_mobile?: string | null;
          emergency_name?: string | null;
          id_type?: Database["public"]["Enums"]["pg_id_type"] | null;
          occupation?: string | null;
          permanent_address?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pg_resident_details_tenant_id_customer_id_fkey";
            columns: ["tenant_id", "customer_id"];
            isOneToOne: true;
            referencedRelation: "rental_customers";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "pg_resident_details_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      pg_rooms: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          floor: string | null;
          id: string;
          name: string;
          notes: string | null;
          rent_mode: Database["public"]["Enums"]["pg_rent_mode"];
          rent_paise: number;
          tenant_id: string;
          under_maintenance: boolean;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          floor?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          rent_mode: Database["public"]["Enums"]["pg_rent_mode"];
          rent_paise: number;
          tenant_id?: string;
          under_maintenance?: boolean;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          floor?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          rent_mode?: Database["public"]["Enums"]["pg_rent_mode"];
          rent_paise?: number;
          tenant_id?: string;
          under_maintenance?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pg_rooms_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      pg_settings: {
        Row: {
          agreement_alert_days: number;
          agreement_months: number;
          deposit_paise: number;
          electricity_paise: number;
          lock_in_months: number;
          notice_days: number;
          rent_increase_pct: number;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          agreement_alert_days?: number;
          agreement_months?: number;
          deposit_paise?: number;
          electricity_paise?: number;
          lock_in_months?: number;
          notice_days?: number;
          rent_increase_pct?: number;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          agreement_alert_days?: number;
          agreement_months?: number;
          deposit_paise?: number;
          electricity_paise?: number;
          lock_in_months?: number;
          notice_days?: number;
          rent_increase_pct?: number;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pg_settings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      pg_stay_adjustments: {
        Row: {
          amount_paise: number;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["pg_adjustment_kind"];
          on_date: string;
          reason: string;
          stay_id: string;
          tenant_id: string;
        };
        Insert: {
          amount_paise: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["pg_adjustment_kind"];
          on_date: string;
          reason: string;
          stay_id: string;
          tenant_id: string;
        };
        Update: {
          amount_paise?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["pg_adjustment_kind"];
          on_date?: string;
          reason?: string;
          stay_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pg_stay_adjustments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pg_stay_adjustments_tenant_id_stay_id_fkey";
            columns: ["tenant_id", "stay_id"];
            isOneToOne: false;
            referencedRelation: "pg_stays";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      pg_stay_rates: {
        Row: {
          created_at: string;
          created_by: string | null;
          effective_from: string;
          electricity_paise: number;
          id: string;
          meal_paise: number;
          meal_plan_id: string | null;
          meal_plan_name: string | null;
          rent_paise: number;
          stay_id: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effective_from: string;
          electricity_paise?: number;
          id?: string;
          meal_paise?: number;
          meal_plan_id?: string | null;
          meal_plan_name?: string | null;
          rent_paise: number;
          stay_id: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          electricity_paise?: number;
          id?: string;
          meal_paise?: number;
          meal_plan_id?: string | null;
          meal_plan_name?: string | null;
          rent_paise?: number;
          stay_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pg_stay_rates_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pg_stay_rates_tenant_id_meal_plan_id_fkey";
            columns: ["tenant_id", "meal_plan_id"];
            isOneToOne: false;
            referencedRelation: "pg_meal_plans";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "pg_stay_rates_tenant_id_stay_id_fkey";
            columns: ["tenant_id", "stay_id"];
            isOneToOne: false;
            referencedRelation: "pg_stays";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      pg_stays: {
        Row: {
          bed_id: string | null;
          cancelled_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          deposit_paise: number;
          id: string;
          moved_out_on: string | null;
          notice_given_on: string | null;
          planned_move_out: string | null;
          room_id: string;
          settled_by: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["pg_stay_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          bed_id?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          deposit_paise?: number;
          id?: string;
          moved_out_on?: string | null;
          notice_given_on?: string | null;
          planned_move_out?: string | null;
          room_id: string;
          settled_by?: string | null;
          start_date: string;
          status?: Database["public"]["Enums"]["pg_stay_status"];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          bed_id?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          deposit_paise?: number;
          id?: string;
          moved_out_on?: string | null;
          notice_given_on?: string | null;
          planned_move_out?: string | null;
          room_id?: string;
          settled_by?: string | null;
          start_date?: string;
          status?: Database["public"]["Enums"]["pg_stay_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pg_stays_tenant_id_bed_id_fkey";
            columns: ["tenant_id", "bed_id"];
            isOneToOne: false;
            referencedRelation: "pg_beds";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "pg_stays_tenant_id_customer_id_fkey";
            columns: ["tenant_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "pg_stays_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pg_stays_tenant_id_room_id_fkey";
            columns: ["tenant_id", "room_id"];
            isOneToOne: false;
            referencedRelation: "pg_rooms";
            referencedColumns: ["tenant_id", "id"];
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
          whatsapp_opt_in: boolean;
          whatsapp_opt_in_at: string | null;
          whatsapp_opted_out_at: string | null;
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
          whatsapp_opt_in?: boolean;
          whatsapp_opt_in_at?: string | null;
          whatsapp_opted_out_at?: string | null;
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
          whatsapp_opt_in?: boolean;
          whatsapp_opt_in_at?: string | null;
          whatsapp_opted_out_at?: string | null;
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
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          closed_at: string | null;
          closed_by: string | null;
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
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
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
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
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
      rental_payments: {
        Row: {
          amount_paise: number;
          id: string;
          kind: Database["public"]["Enums"]["payment_kind"];
          mode: Database["public"]["Enums"]["payment_mode"];
          note: string | null;
          received_at: string;
          received_by: string | null;
          rental_order_id: string;
          reverses_payment_id: string | null;
          tenant_id: string;
        };
        Insert: {
          amount_paise: number;
          id?: string;
          kind?: Database["public"]["Enums"]["payment_kind"];
          mode: Database["public"]["Enums"]["payment_mode"];
          note?: string | null;
          received_at?: string;
          received_by?: string | null;
          rental_order_id: string;
          reverses_payment_id?: string | null;
          tenant_id?: string;
        };
        Update: {
          amount_paise?: number;
          id?: string;
          kind?: Database["public"]["Enums"]["payment_kind"];
          mode?: Database["public"]["Enums"]["payment_mode"];
          note?: string | null;
          received_at?: string;
          received_by?: string | null;
          rental_order_id?: string;
          reverses_payment_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_payments_reverses_payment_id_fkey";
            columns: ["reverses_payment_id"];
            isOneToOne: true;
            referencedRelation: "rental_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_payments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_payments_tenant_id_rental_order_id_fkey";
            columns: ["tenant_id", "rental_order_id"];
            isOneToOne: false;
            referencedRelation: "rental_orders";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      rental_returns: {
        Row: {
          condition_notes: string | null;
          id: string;
          quantity_returned: number;
          recorded_at: string;
          recorded_by: string | null;
          rental_order_id: string;
          rental_order_item_id: string;
          returned_on: string;
          tenant_id: string;
        };
        Insert: {
          condition_notes?: string | null;
          id?: string;
          quantity_returned: number;
          recorded_at?: string;
          recorded_by?: string | null;
          rental_order_id: string;
          rental_order_item_id: string;
          returned_on: string;
          tenant_id?: string;
        };
        Update: {
          condition_notes?: string | null;
          id?: string;
          quantity_returned?: number;
          recorded_at?: string;
          recorded_by?: string | null;
          rental_order_id?: string;
          rental_order_item_id?: string;
          returned_on?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_returns_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_returns_tenant_id_rental_order_id_fkey";
            columns: ["tenant_id", "rental_order_id"];
            isOneToOne: false;
            referencedRelation: "rental_orders";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "rental_returns_tenant_id_rental_order_item_id_fkey";
            columns: ["tenant_id", "rental_order_item_id"];
            isOneToOne: false;
            referencedRelation: "rental_order_items";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      subscription_payments: {
        Row: {
          amount_paise: number;
          created_at: string;
          id: string;
          notes: string | null;
          payment_date: string;
          payment_method: Database["public"]["Enums"]["subscription_payment_method"];
          period_end: string;
          period_start: string;
          recorded_by: string | null;
          reference_number: string | null;
          tenant_id: string;
        };
        Insert: {
          amount_paise: number;
          created_at?: string;
          id?: string;
          notes?: string | null;
          payment_date: string;
          payment_method: Database["public"]["Enums"]["subscription_payment_method"];
          period_end: string;
          period_start: string;
          recorded_by?: string | null;
          reference_number?: string | null;
          tenant_id: string;
        };
        Update: {
          amount_paise?: number;
          created_at?: string;
          id?: string;
          notes?: string | null;
          payment_date?: string;
          payment_method?: Database["public"]["Enums"]["subscription_payment_method"];
          period_end?: string;
          period_start?: string;
          recorded_by?: string | null;
          reference_number?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_payments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          business_type: Database["public"]["Enums"]["business_type"];
          created_at: string;
          email: string | null;
          id: string;
          is_test: boolean;
          name: string;
          phone: string | null;
          plan: string | null;
          status: Database["public"]["Enums"]["tenant_status"];
          subscription_ends_at: string | null;
          trial_ends_at: string | null;
          updated_at: string;
          whatsapp_addon: boolean;
        };
        Insert: {
          business_type?: Database["public"]["Enums"]["business_type"];
          created_at?: string;
          email?: string | null;
          id?: string;
          is_test?: boolean;
          name: string;
          phone?: string | null;
          plan?: string | null;
          status?: Database["public"]["Enums"]["tenant_status"];
          subscription_ends_at?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          whatsapp_addon?: boolean;
        };
        Update: {
          business_type?: Database["public"]["Enums"]["business_type"];
          created_at?: string;
          email?: string | null;
          id?: string;
          is_test?: boolean;
          name?: string;
          phone?: string | null;
          plan?: string | null;
          status?: Database["public"]["Enums"]["tenant_status"];
          subscription_ends_at?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          whatsapp_addon?: boolean;
        };
        Relationships: [];
      };
      whatsapp_connections: {
        Row: {
          connected_by: string | null;
          created_at: string;
          display_phone_number: string;
          id: string;
          phone_number_id: string;
          status: Database["public"]["Enums"]["whatsapp_connection_status"];
          tenant_id: string;
          updated_at: string;
          waba_id: string;
        };
        Insert: {
          connected_by?: string | null;
          created_at?: string;
          display_phone_number: string;
          id?: string;
          phone_number_id: string;
          status?: Database["public"]["Enums"]["whatsapp_connection_status"];
          tenant_id: string;
          updated_at?: string;
          waba_id: string;
        };
        Update: {
          connected_by?: string | null;
          created_at?: string;
          display_phone_number?: string;
          id?: string;
          phone_number_id?: string;
          status?: Database["public"]["Enums"]["whatsapp_connection_status"];
          tenant_id?: string;
          updated_at?: string;
          waba_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_settings: {
        Row: {
          auto_booking_details: boolean;
          evening_reminder: boolean;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          auto_booking_details?: boolean;
          evening_reminder?: boolean;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          auto_booking_details?: boolean;
          evening_reminder?: boolean;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cancel_booking: { Args: { p_order_id: string; p_reason: string }; Returns: undefined };
      close_booking: { Args: { p_order_id: string }; Returns: undefined };
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
      delete_test_business: {
        Args: { p_confirm_name: string; p_tenant_id: string };
        Returns: Json;
      };
      item_commitments: {
        Args: { p_end: string; p_start: string };
        Returns: {
          committed: number;
          rental_item_id: string;
        }[];
      };
      mark_password_changed: { Args: Record<PropertyKey, never>; Returns: undefined };
      pg_add_adjustment: {
        Args: {
          p_amount_paise: number;
          p_kind: Database["public"]["Enums"]["pg_adjustment_kind"];
          p_reason: string;
          p_stay_id: string;
        };
        Returns: string;
      };
      pg_cancel_stay: { Args: { p_stay_id: string }; Returns: undefined };
      pg_change_rates: {
        Args: {
          p_effective_from: string;
          p_electricity_paise: number;
          p_meal_plan_id: string;
          p_rent_paise: number;
          p_stay_id: string;
        };
        Returns: undefined;
      };
      pg_create_agreement: {
        Args: {
          p_increase_pct?: number;
          p_lock_in_months?: number;
          p_months: number;
          p_start: string;
          p_stay_id: string;
        };
        Returns: string;
      };
      pg_create_room: {
        Args: {
          p_beds: number;
          p_floor: string;
          p_name: string;
          p_notes?: string;
          p_rent_mode: Database["public"]["Enums"]["pg_rent_mode"];
          p_rent_paise: number;
        };
        Returns: string;
      };
      pg_give_notice: {
        Args: { p_notice_on: string; p_planned_move_out: string; p_stay_id: string };
        Returns: undefined;
      };
      pg_move_in: {
        Args: {
          p_bed_id: string;
          p_customer_id: string;
          p_deposit_paise: number;
          p_meal_plan_id: string;
          p_rent_paise?: number;
          p_room_id: string;
          p_start_date: string;
        };
        Returns: string;
      };
      pg_renew_agreement: {
        Args: { p_agreement_id: string; p_months: number; p_new_rent_paise?: number };
        Returns: string;
      };
      pg_set_agreement_document: {
        Args: { p_agreement_id: string; p_path: string; p_size: number; p_type: string };
        Returns: string;
      };
      pg_settle_move_out: {
        Args: { p_deductions?: Json; p_moved_out_on: string; p_stay_id: string };
        Returns: number;
      };
      pg_update_agreement: {
        Args: {
          p_agreement_id: string;
          p_end: string;
          p_increase_pct: number;
          p_lock_in_until: string;
        };
        Returns: undefined;
      };
      pg_withdraw_notice: { Args: { p_stay_id: string }; Returns: undefined };
      provision_tenant_with_owner: {
        Args: {
          p_business_type?: Database["public"]["Enums"]["business_type"];
          p_is_test?: boolean;
          p_owner_id: string;
          p_owner_mobile: string;
          p_owner_name: string;
          p_tenant_name: string;
          p_tenant_phone?: string;
          p_trial_days?: number;
        };
        Returns: string;
      };
      record_returns: {
        Args: { p_items: Json; p_notes?: string; p_order_id: string; p_returned_on: string };
        Returns: number;
      };
      wa_access_token: { Args: { p_tenant_id: string }; Returns: string };
      wa_set_credentials: {
        Args: { p_access_token: string; p_tenant_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "SUPER_ADMIN" | "ADMIN" | "STAFF";
      booking_status: "ACTIVE" | "PARTIALLY_RETURNED" | "RETURNED" | "OVERDUE" | "CANCELLED";
      business_type: "TENT_HOUSE" | "HOSTEL_PG";
      discount_type: "NONE" | "FLAT" | "PERCENT";
      message_channel: "WHATSAPP" | "SMS";
      message_log_channel: "WHATSAPP" | "SMS" | "COPY" | "WHATSAPP_API";
      message_type:
        | "BOOKING_CONFIRMATION"
        | "AMOUNT_DUE"
        | "RETURN_CONFIRMATION"
        | "RENT_DUE"
        | "PAYMENT_RECEIPT"
        | "AGREEMENT_RENEWAL";
      payment_kind: "PAYMENT" | "REVERSAL";
      payment_mode: "CASH" | "UPI" | "CARD" | "OTHER";
      pg_adjustment_kind: "CHARGE" | "DISCOUNT";
      pg_agreement_status: "ACTIVE" | "RENEWED" | "ENDED";
      pg_complaint_category:
        "ELECTRICAL" | "PLUMBING" | "CLEANING" | "FURNITURE" | "WIFI" | "FOOD" | "OTHER";
      pg_complaint_priority: "NORMAL" | "URGENT";
      pg_complaint_status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
      pg_id_side: "FRONT" | "BACK" | "OTHER";
      pg_id_type:
        "AADHAAR" | "PAN" | "DRIVING_LICENCE" | "VOTER_ID" | "PASSPORT" | "COLLEGE_ID" | "OTHER";
      pg_payment_purpose: "RENT" | "DEPOSIT" | "REFUND";
      pg_rent_mode: "PER_BED" | "PER_ROOM";
      pg_stay_status: "ACTIVE" | "NOTICE" | "MOVED_OUT" | "CANCELLED";
      profile_status: "ACTIVE" | "INACTIVE";
      rate_unit: "PER_DAY" | "PER_EVENT";
      subscription_payment_method: "UPI" | "BANK_TRANSFER" | "CASH" | "OTHER";
      tenant_status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
      whatsapp_connection_status: "CONNECTED" | "DISCONNECTED";
      whatsapp_delivery_status: "SENT" | "DELIVERED" | "READ" | "FAILED" | "PENDING";
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
      business_type: ["TENT_HOUSE", "HOSTEL_PG"],
      discount_type: ["NONE", "FLAT", "PERCENT"],
      message_channel: ["WHATSAPP", "SMS"],
      message_log_channel: ["WHATSAPP", "SMS", "COPY", "WHATSAPP_API"],
      message_type: [
        "BOOKING_CONFIRMATION",
        "AMOUNT_DUE",
        "RETURN_CONFIRMATION",
        "RENT_DUE",
        "PAYMENT_RECEIPT",
        "AGREEMENT_RENEWAL",
      ],
      payment_kind: ["PAYMENT", "REVERSAL"],
      payment_mode: ["CASH", "UPI", "CARD", "OTHER"],
      pg_adjustment_kind: ["CHARGE", "DISCOUNT"],
      pg_agreement_status: ["ACTIVE", "RENEWED", "ENDED"],
      pg_complaint_category: [
        "ELECTRICAL",
        "PLUMBING",
        "CLEANING",
        "FURNITURE",
        "WIFI",
        "FOOD",
        "OTHER",
      ],
      pg_complaint_priority: ["NORMAL", "URGENT"],
      pg_complaint_status: ["OPEN", "IN_PROGRESS", "RESOLVED"],
      pg_id_side: ["FRONT", "BACK", "OTHER"],
      pg_id_type: [
        "AADHAAR",
        "PAN",
        "DRIVING_LICENCE",
        "VOTER_ID",
        "PASSPORT",
        "COLLEGE_ID",
        "OTHER",
      ],
      pg_payment_purpose: ["RENT", "DEPOSIT", "REFUND"],
      pg_rent_mode: ["PER_BED", "PER_ROOM"],
      pg_stay_status: ["ACTIVE", "NOTICE", "MOVED_OUT", "CANCELLED"],
      profile_status: ["ACTIVE", "INACTIVE"],
      rate_unit: ["PER_DAY", "PER_EVENT"],
      subscription_payment_method: ["UPI", "BANK_TRANSFER", "CASH", "OTHER"],
      tenant_status: ["TRIAL", "ACTIVE", "SUSPENDED", "EXPIRED"],
      whatsapp_connection_status: ["CONNECTED", "DISCONNECTED"],
      whatsapp_delivery_status: ["SENT", "DELIVERED", "READ", "FAILED", "PENDING"],
    },
  },
} as const;
