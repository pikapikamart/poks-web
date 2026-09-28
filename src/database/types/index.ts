export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      account_deletions: {
        Row: {
          attempts: number;
          created_at: string;
          last_error: string | null;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          last_error?: string | null;
          user_id: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          last_error?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_operations: {
        Row: {
          actions: Json;
          completed_at: string | null;
          created_at: string;
          dependencies: Json;
          id: string;
          proposal: Json;
          request_body: Json;
          request_id: string;
          result: Json | null;
          sources: Json;
          status: string;
          user_id: string;
        };
        Insert: {
          actions: Json;
          completed_at?: string | null;
          created_at?: string;
          dependencies?: Json;
          id?: string;
          proposal: Json;
          request_body: Json;
          request_id: string;
          result?: Json | null;
          sources?: Json;
          status?: string;
          user_id: string;
        };
        Update: {
          actions?: Json;
          completed_at?: string | null;
          created_at?: string;
          dependencies?: Json;
          id?: string;
          proposal?: Json;
          request_body?: Json;
          request_id?: string;
          result?: Json | null;
          sources?: Json;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      api_rate_limits: {
        Row: {
          bucket: string;
          count: number;
          subject: string;
          window_start: string;
        };
        Insert: {
          bucket: string;
          count: number;
          subject: string;
          window_start: string;
        };
        Update: {
          bucket?: string;
          count?: number;
          subject?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      collaboration_activity: {
        Row: {
          actor_id: string | null;
          body: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          reminder_id: string | null;
          space_id: string | null;
        };
        Insert: {
          actor_id?: string | null;
          body: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          reminder_id?: string | null;
          space_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          body?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          reminder_id?: string | null;
          space_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "collaboration_activity_reminder_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collaboration_activity_space_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      context_reminders: {
        Row: {
          context_id: string;
          created_at: string;
          reminder_id: string;
        };
        Insert: {
          context_id: string;
          created_at?: string;
          reminder_id: string;
        };
        Update: {
          context_id?: string;
          created_at?: string;
          reminder_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "context_reminders_context_id_fkey";
            columns: ["context_id"];
            isOneToOne: false;
            referencedRelation: "contexts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_reminders_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: true;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
        ];
      };
      contexts: {
        Row: {
          content: Json;
          deleted: boolean;
          id: string;
          kind: string;
          owner_id: string;
          recurrence_anchor: string | null;
          search_vector: unknown;
          space_id: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          content: Json;
          deleted?: boolean;
          id: string;
          kind?: string;
          owner_id: string;
          recurrence_anchor?: string | null;
          search_vector?: unknown;
          space_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          content?: Json;
          deleted?: boolean;
          id?: string;
          kind?: string;
          owner_id?: string;
          recurrence_anchor?: string | null;
          search_vector?: unknown;
          space_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          accepted_by: string | null;
          expires_at: string;
          id: string;
          revoked: boolean;
          role: string;
          space_id: string;
          token: string;
        };
        Insert: {
          accepted_by?: string | null;
          expires_at?: string;
          id?: string;
          revoked?: boolean;
          role: string;
          space_id: string;
          token?: string;
        };
        Update: {
          accepted_by?: string | null;
          expires_at?: string;
          id?: string;
          revoked?: boolean;
          role?: string;
          space_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_deliveries: {
        Row: {
          attempts: number;
          body: string | null;
          claim_token: string | null;
          due_at: string;
          generation: number;
          id: string;
          kind: string;
          last_error: string | null;
          lease_until: string | null;
          receipt_ids: Json;
          reminder_id: string | null;
          revision: number;
          status: string;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          body?: string | null;
          claim_token?: string | null;
          due_at: string;
          generation?: number;
          id?: string;
          kind: string;
          last_error?: string | null;
          lease_until?: string | null;
          receipt_ids?: Json;
          reminder_id?: string | null;
          revision: number;
          status?: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          body?: string | null;
          claim_token?: string | null;
          due_at?: string;
          generation?: number;
          id?: string;
          kind?: string;
          last_error?: string | null;
          lease_until?: string | null;
          receipt_ids?: Json;
          reminder_id?: string | null;
          revision?: number;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_reminder_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_device_deliveries: {
        Row: {
          accepted_at: string | null;
          attempts: number;
          delivery_id: string;
          last_error: string | null;
          receipt_status: string | null;
          status: string;
          ticket_id: string | null;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          attempts?: number;
          delivery_id: string;
          last_error?: string | null;
          receipt_status?: string | null;
          status?: string;
          ticket_id?: string | null;
          token: string;
        };
        Update: {
          accepted_at?: string | null;
          attempts?: number;
          delivery_id?: string;
          last_error?: string | null;
          receipt_status?: string | null;
          status?: string;
          ticket_id?: string | null;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_device_deliveries_delivery_fkey";
            columns: ["delivery_id"];
            isOneToOne: false;
            referencedRelation: "notification_deliveries";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_devices: {
        Row: {
          token: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_epochs: {
        Row: {
          generation: number;
          user_id: string;
        };
        Insert: {
          generation?: number;
          user_id: string;
        };
        Update: {
          generation?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_inbox: {
        Row: {
          body: string;
          created_at: string;
          event_key: string | null;
          id: string;
          read: boolean;
          reminder_id: string | null;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          event_key?: string | null;
          id?: string;
          read?: boolean;
          reminder_id?: string | null;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          event_key?: string | null;
          id?: string;
          read?: boolean;
          reminder_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_inbox_reminder_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          display_name: string;
          id: string;
          preferences: Json;
        };
        Insert: {
          display_name?: string;
          id: string;
          preferences?: Json;
        };
        Update: {
          display_name?: string;
          id?: string;
          preferences?: Json;
        };
        Relationships: [];
      };
      reminder_operations: {
        Row: {
          id: string;
          result: Json;
          user_id: string;
        };
        Insert: {
          id: string;
          result: Json;
          user_id: string;
        };
        Update: {
          id?: string;
          result?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      reminder_outbox: {
        Row: {
          created_at: string;
          failures: number;
          generation: number;
          id: number;
          last_error: string | null;
          processed: boolean;
          reminder_id: string;
          retry_at: string;
          revision: number;
        };
        Insert: {
          created_at?: string;
          failures?: number;
          generation?: number;
          id?: never;
          last_error?: string | null;
          processed?: boolean;
          reminder_id: string;
          retry_at?: string;
          revision: number;
        };
        Update: {
          created_at?: string;
          failures?: number;
          generation?: number;
          id?: never;
          last_error?: string | null;
          processed?: boolean;
          reminder_id?: string;
          retry_at?: string;
          revision?: number;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_outbox_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
        ];
      };
      reminder_recurrences: {
        Row: {
          next_reminder_id: string | null;
          parent_reminder_id: string;
        };
        Insert: {
          next_reminder_id?: string | null;
          parent_reminder_id: string;
        };
        Update: {
          next_reminder_id?: string | null;
          parent_reminder_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_recurrences_next_fkey";
            columns: ["next_reminder_id"];
            isOneToOne: true;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminder_recurrences_parent_fkey";
            columns: ["parent_reminder_id"];
            isOneToOne: true;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders: {
        Row: {
          content: Json;
          deleted: boolean;
          id: string;
          kind: string;
          owner_id: string;
          recurrence_anchor: string | null;
          search_vector: unknown;
          space_id: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          content: Json;
          deleted?: boolean;
          id: string;
          kind: string;
          owner_id: string;
          recurrence_anchor?: string | null;
          search_vector?: unknown;
          space_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          content?: Json;
          deleted?: boolean;
          id?: string;
          kind?: string;
          owner_id?: string;
          recurrence_anchor?: string | null;
          search_vector?: unknown;
          space_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "records_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      space_members: {
        Row: {
          role: string;
          space_id: string;
          user_id: string;
        };
        Insert: {
          role: string;
          space_id: string;
          user_id: string;
        };
        Update: {
          role?: string;
          space_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "members_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      space_reminders: {
        Row: {
          created_at: string;
          reminder_id: string;
          space_id: string;
        };
        Insert: {
          created_at?: string;
          reminder_id: string;
          space_id: string;
        };
        Update: {
          created_at?: string;
          reminder_id?: string;
          space_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "space_reminders_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: true;
            referencedRelation: "reminders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "space_reminders_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      spaces: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          owner_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string };
      account_active: { Args: never; Returns: boolean };
      apply_ai_operation: {
        Args: {
          p_actions: Json;
          p_proposal: Json;
          p_request: string;
          p_request_body: Json;
          p_sources: Json;
        };
        Returns: Json;
      };
      can_edit_context: {
        Args: { c: Database["public"]["Tables"]["contexts"]["Row"] };
        Returns: boolean;
      };
      can_edit_record: {
        Args: { r: Database["public"]["Tables"]["reminders"]["Row"] };
        Returns: boolean;
      };
      can_edit_reminder: {
        Args: { r: Database["public"]["Tables"]["reminders"]["Row"] };
        Returns: boolean;
      };
      can_read_context: {
        Args: { c: Database["public"]["Tables"]["contexts"]["Row"] };
        Returns: boolean;
      };
      can_read_record: {
        Args: { r: Database["public"]["Tables"]["reminders"]["Row"] };
        Returns: boolean;
      };
      can_read_reminder: {
        Args: { r: Database["public"]["Tables"]["reminders"]["Row"] };
        Returns: boolean;
      };
      check_ai_sources: { Args: { p_dependencies: Json }; Returns: undefined };
      claim_deliveries: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          body: string | null;
          claim_token: string | null;
          due_at: string;
          generation: number;
          id: string;
          kind: string;
          last_error: string | null;
          lease_until: string | null;
          receipt_ids: Json;
          reminder_id: string | null;
          revision: number;
          status: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "notification_deliveries";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      cleanup_account: { Args: { p_user: string }; Returns: undefined };
      consume_api_rate: {
        Args: {
          p_bucket: string;
          p_limit: number;
          p_subject: string;
          p_window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          remaining: number;
          request_limit: number;
          reset_at: string;
        }[];
      };
      create_space:
        | {
            Args: { p_name: string };
            Returns: {
              color: string;
              created_at: string;
              id: string;
              name: string;
              owner_id: string;
            };
            SetofOptions: {
              from: "*";
              to: "spaces";
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: { p_color: string; p_name: string };
            Returns: {
              color: string;
              created_at: string;
              id: string;
              name: string;
              owner_id: string;
            };
            SetofOptions: {
              from: "*";
              to: "spaces";
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      delete_space: { Args: { p_space: string }; Returns: undefined };
      due_recurrences: {
        Args: never;
        Returns: {
          content: Json;
          deleted: boolean;
          id: string;
          kind: string;
          owner_id: string;
          recurrence_anchor: string | null;
          search_vector: unknown;
          space_id: string | null;
          updated_at: string;
          version: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "reminders";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      finish_device_attempt: {
        Args: {
          p_claim: string;
          p_error?: string;
          p_job: string;
          p_status: string;
          p_ticket?: string;
          p_token: string;
        };
        Returns: boolean;
      };
      inspect_invite: { Args: { p_token: string }; Returns: Json };
      invite: {
        Args: { p_role: string; p_space: string };
        Returns: {
          accepted_by: string | null;
          expires_at: string;
          id: string;
          revoked: boolean;
          role: string;
          space_id: string;
          token: string;
        };
        SetofOptions: {
          from: "*";
          to: "invitations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      leave_space: { Args: { p_space: string }; Returns: undefined };
      manage_member: {
        Args: { p_role: string; p_space: string; p_user: string };
        Returns: undefined;
      };
      post_note: {
        Args: { p_body: string; p_record: string };
        Returns: undefined;
      };
      prepare_account_deletion: { Args: never; Returns: undefined };
      record_push_receipt: {
        Args: {
          p_job: string;
          p_outcome: string;
          p_ticket: string;
          p_token: string;
        };
        Returns: undefined;
      };
      reschedule_user: { Args: { p_user: string }; Returns: undefined };
      revoke_invite: { Args: { p_id: string }; Returns: undefined };
      save_record: {
        Args: { p_expected: number; p_operation: string; p_record: Json };
        Returns: Json;
      };
      save_record_internal: {
        Args: { p_expected: number; p_operation: string; p_record: Json };
        Returns: Json;
      };
      space_role: { Args: { s: string }; Returns: string };
      spawn_occurrence: {
        Args: { p_content: Json; p_parent: string; p_revision: number };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
