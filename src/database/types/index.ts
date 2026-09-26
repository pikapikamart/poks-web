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
      activity: {
        Row: {
          actor_id: string | null;
          body: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          record_id: string | null;
          space_id: string | null;
        };
        Insert: {
          actor_id?: string | null;
          body: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          record_id?: string | null;
          space_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          body?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          record_id?: string | null;
          space_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_record_id_fkey";
            columns: ["record_id"];
            isOneToOne: false;
            referencedRelation: "records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_proposals: {
        Row: {
          actions: Json;
          applied: boolean;
          dependencies: Json;
          expires_at: string;
          id: string;
          request_body: Json | null;
          request_id: string | null;
          result: Json | null;
          review_id: string | null;
          user_id: string;
        };
        Insert: {
          actions: Json;
          applied?: boolean;
          dependencies?: Json;
          expires_at?: string;
          id?: string;
          request_body?: Json | null;
          request_id?: string | null;
          result?: Json | null;
          review_id?: string | null;
          user_id: string;
        };
        Update: {
          actions?: Json;
          applied?: boolean;
          dependencies?: Json;
          expires_at?: string;
          id?: string;
          request_body?: Json | null;
          request_id?: string | null;
          result?: Json | null;
          review_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_proposals_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "ai_reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_reviews: {
        Row: {
          expires_at: string;
          id: string;
          sources: Json;
          user_id: string;
        };
        Insert: {
          expires_at?: string;
          id?: string;
          sources: Json;
          user_id: string;
        };
        Update: {
          expires_at?: string;
          id?: string;
          sources?: Json;
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
      deliveries: {
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
          record_id: string;
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
          record_id: string;
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
          record_id?: string;
          revision?: number;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deliveries_record_id_fkey";
            columns: ["record_id"];
            isOneToOne: false;
            referencedRelation: "records";
            referencedColumns: ["id"];
          },
        ];
      };
      device_deliveries: {
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
            foreignKeyName: "device_deliveries_delivery_id_fkey";
            columns: ["delivery_id"];
            isOneToOne: false;
            referencedRelation: "deliveries";
            referencedColumns: ["id"];
          },
        ];
      };
      devices: {
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
      inbox: {
        Row: {
          body: string;
          created_at: string;
          event_key: string | null;
          id: string;
          read: boolean;
          record_id: string | null;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          event_key?: string | null;
          id?: string;
          read?: boolean;
          record_id?: string | null;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          event_key?: string | null;
          id?: string;
          read?: boolean;
          record_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inbox_record_id_fkey";
            columns: ["record_id"];
            isOneToOne: false;
            referencedRelation: "records";
            referencedColumns: ["id"];
          },
        ];
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
      members: {
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
      operations: {
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
      outbox: {
        Row: {
          created_at: string;
          failures: number;
          generation: number;
          id: number;
          last_error: string | null;
          processed: boolean;
          record_id: string;
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
          record_id: string;
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
          record_id?: string;
          retry_at?: string;
          revision?: number;
        };
        Relationships: [
          {
            foreignKeyName: "outbox_record_id_fkey";
            columns: ["record_id"];
            isOneToOne: false;
            referencedRelation: "records";
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
      records: {
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
      recurrences: {
        Row: {
          next_id: string | null;
          parent_id: string;
        };
        Insert: {
          next_id?: string | null;
          parent_id: string;
        };
        Update: {
          next_id?: string | null;
          parent_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurrences_next_id_fkey";
            columns: ["next_id"];
            isOneToOne: true;
            referencedRelation: "records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurrences_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: true;
            referencedRelation: "records";
            referencedColumns: ["id"];
          },
        ];
      };
      spaces: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_id: string;
        };
        Update: {
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
      apply_proposal: { Args: { p_id: string }; Returns: Json };
      can_edit_record: {
        Args: { r: Database["public"]["Tables"]["records"]["Row"] };
        Returns: boolean;
      };
      can_read_record: {
        Args: { r: Database["public"]["Tables"]["records"]["Row"] };
        Returns: boolean;
      };
      check_review_sources: {
        Args: { p_dependencies: Json };
        Returns: undefined;
      };
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
          record_id: string;
          revision: number;
          status: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "deliveries";
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
      create_space: {
        Args: { p_name: string };
        Returns: {
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
          to: "records";
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
      prepare_proposal: {
        Args: {
          p_actions: Json;
          p_body: Json;
          p_request: string;
          p_review: string;
        };
        Returns: string;
      };
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
