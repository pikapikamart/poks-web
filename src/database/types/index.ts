// Database types. Regenerate with npm run supabase:gentypes from web.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Database = {
  public: {
    Tables: {
      account_deletions: {
        Row: {
          user_id: string;
          created_at: string;
          attempts: number;
          last_error: string | null;
        };
        Insert: {
          user_id: string;
          created_at?: string;
          attempts?: number;
          last_error?: string | null;
        };
        Update: {
          user_id?: string;
          created_at?: string;
          attempts?: number;
          last_error?: string | null;
        };
        Relationships: [];
      };
      activity: {
        Row: {
          id: string;
          record_id: string | null;
          space_id: string | null;
          actor_id: string | null;
          body: string;
          created_at: string;
          event_type: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          record_id?: string | null;
          space_id?: string | null;
          actor_id?: string | null;
          body: string;
          created_at?: string;
          event_type?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          record_id?: string | null;
          space_id?: string | null;
          actor_id?: string | null;
          body?: string;
          created_at?: string;
          event_type?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      ai_proposals: {
        Row: {
          id: string;
          user_id: string;
          actions: Json;
          expires_at: string;
          applied: boolean;
          review_id: string | null;
          request_id: string | null;
          request_body: Json | null;
          result: Json | null;
          dependencies: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          actions: Json;
          expires_at?: string;
          applied?: boolean;
          review_id?: string | null;
          request_id?: string | null;
          request_body?: Json | null;
          result?: Json | null;
          dependencies?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          actions?: Json;
          expires_at?: string;
          applied?: boolean;
          review_id?: string | null;
          request_id?: string | null;
          request_body?: Json | null;
          result?: Json | null;
          dependencies?: Json;
        };
        Relationships: [];
      };
      ai_reviews: {
        Row: {
          id: string;
          user_id: string;
          sources: Json;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sources: Json;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          sources?: Json;
          expires_at?: string;
        };
        Relationships: [];
      };
      deliveries: {
        Row: {
          id: string;
          record_id: string;
          revision: number;
          user_id: string;
          kind: string;
          due_at: string;
          status: string;
          attempts: number;
          lease_until: string | null;
          receipt_ids: Json;
          last_error: string | null;
          generation: number;
          claim_token: string | null;
          body: string | null;
        };
        Insert: {
          id?: string;
          record_id: string;
          revision: number;
          user_id: string;
          kind: string;
          due_at: string;
          status?: string;
          attempts?: number;
          lease_until?: string | null;
          receipt_ids?: Json;
          last_error?: string | null;
          generation?: number;
          claim_token?: string | null;
          body?: string | null;
        };
        Update: {
          id?: string;
          record_id?: string;
          revision?: number;
          user_id?: string;
          kind?: string;
          due_at?: string;
          status?: string;
          attempts?: number;
          lease_until?: string | null;
          receipt_ids?: Json;
          last_error?: string | null;
          generation?: number;
          claim_token?: string | null;
          body?: string | null;
        };
        Relationships: [];
      };
      device_deliveries: {
        Row: {
          delivery_id: string;
          token: string;
          status: string;
          attempts: number;
          ticket_id: string | null;
          receipt_status: string | null;
          accepted_at: string | null;
          last_error: string | null;
        };
        Insert: {
          delivery_id: string;
          token: string;
          status?: string;
          attempts?: number;
          ticket_id?: string | null;
          receipt_status?: string | null;
          accepted_at?: string | null;
          last_error?: string | null;
        };
        Update: {
          delivery_id?: string;
          token?: string;
          status?: string;
          attempts?: number;
          ticket_id?: string | null;
          receipt_status?: string | null;
          accepted_at?: string | null;
          last_error?: string | null;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          token: string;
          user_id: string;
          updated_at: string;
        };
        Insert: {
          token: string;
          user_id: string;
          updated_at?: string;
        };
        Update: {
          token?: string;
          user_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inbox: {
        Row: {
          id: string;
          user_id: string;
          record_id: string | null;
          body: string;
          read: boolean;
          created_at: string;
          event_key: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          record_id?: string | null;
          body: string;
          read?: boolean;
          created_at?: string;
          event_key?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          record_id?: string | null;
          body?: string;
          read?: boolean;
          created_at?: string;
          event_key?: string | null;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          space_id: string;
          token: string;
          role: string;
          expires_at: string;
          revoked: boolean;
          accepted_by: string | null;
        };
        Insert: {
          id?: string;
          space_id: string;
          token?: string;
          role: string;
          expires_at?: string;
          revoked?: boolean;
          accepted_by?: string | null;
        };
        Update: {
          id?: string;
          space_id?: string;
          token?: string;
          role?: string;
          expires_at?: string;
          revoked?: boolean;
          accepted_by?: string | null;
        };
        Relationships: [];
      };
      members: {
        Row: {
          space_id: string;
          user_id: string;
          role: string;
        };
        Insert: {
          space_id: string;
          user_id: string;
          role: string;
        };
        Update: {
          space_id?: string;
          user_id?: string;
          role?: string;
        };
        Relationships: [];
      };
      notification_epochs: {
        Row: {
          user_id: string;
          generation: number;
        };
        Insert: {
          user_id: string;
          generation?: number;
        };
        Update: {
          user_id?: string;
          generation?: number;
        };
        Relationships: [];
      };
      operations: {
        Row: {
          user_id: string;
          id: string;
          result: Json;
        };
        Insert: {
          user_id: string;
          id: string;
          result: Json;
        };
        Update: {
          user_id?: string;
          id?: string;
          result?: Json;
        };
        Relationships: [];
      };
      outbox: {
        Row: {
          id: number;
          record_id: string;
          revision: number;
          processed: boolean;
          created_at: string;
          generation: number;
          failures: number;
          retry_at: string;
          last_error: string | null;
        };
        Insert: {
          id?: number;
          record_id: string;
          revision: number;
          processed?: boolean;
          created_at?: string;
          generation?: number;
          failures?: number;
          retry_at?: string;
          last_error?: string | null;
        };
        Update: {
          id?: number;
          record_id?: string;
          revision?: number;
          processed?: boolean;
          created_at?: string;
          generation?: number;
          failures?: number;
          retry_at?: string;
          last_error?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          preferences: Json;
        };
        Insert: {
          id: string;
          display_name?: string;
          preferences?: Json;
        };
        Update: {
          id?: string;
          display_name?: string;
          preferences?: Json;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          user_id: string;
          bucket: string;
          window_start: string;
          count: number;
        };
        Insert: {
          user_id: string;
          bucket: string;
          window_start: string;
          count: number;
        };
        Update: {
          user_id?: string;
          bucket?: string;
          window_start?: string;
          count?: number;
        };
        Relationships: [];
      };
      records: {
        Row: {
          id: string;
          owner_id: string;
          space_id: string | null;
          kind: string;
          content: Json;
          version: number;
          deleted: boolean;
          updated_at: string;
          search_vector: string | null;
          recurrence_anchor: string | null;
        };
        Insert: {
          id: string;
          owner_id: string;
          space_id?: string | null;
          kind: string;
          content: Json;
          version?: number;
          deleted?: boolean;
          updated_at?: string;
          search_vector?: never;
          recurrence_anchor?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          space_id?: string | null;
          kind?: string;
          content?: Json;
          version?: number;
          deleted?: boolean;
          updated_at?: string;
          search_vector?: never;
          recurrence_anchor?: string | null;
        };
        Relationships: [];
      };
      recurrences: {
        Row: {
          parent_id: string;
          next_id: string | null;
        };
        Insert: {
          parent_id: string;
          next_id?: string | null;
        };
        Update: {
          parent_id?: string;
          next_id?: string | null;
        };
        Relationships: [];
      };
      spaces: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      accept_invite: { Args: { p_token: string | null }; Returns: string };
      account_active: { Args: Record<never, never>; Returns: boolean };
      apply_proposal: { Args: { p_id: string | null }; Returns: Json };
      can_edit_record: {
        Args: { r: Database["public"]["Tables"]["records"]["Row"] | null };
        Returns: boolean;
      };
      can_read_record: {
        Args: { r: Database["public"]["Tables"]["records"]["Row"] | null };
        Returns: boolean;
      };
      check_review_sources: {
        Args: { p_dependencies: Json | null };
        Returns: undefined;
      };
      claim_deliveries: {
        Args: { p_limit: number | null };
        Returns: Database["public"]["Tables"]["deliveries"]["Row"][];
      };
      cleanup_account: { Args: { p_user: string | null }; Returns: undefined };
      consume_rate: {
        Args: {
          p_user: string | null;
          p_bucket: string | null;
          p_max: number | null;
        };
        Returns: boolean;
      };
      create_space: {
        Args: { p_name: string | null };
        Returns: Database["public"]["Tables"]["spaces"]["Row"];
      };
      delete_space: { Args: { p_space: string | null }; Returns: undefined };
      due_recurrences: {
        Args: Record<never, never>;
        Returns: Database["public"]["Tables"]["records"]["Row"][];
      };
      finish_device_attempt: {
        Args: {
          p_job: string | null;
          p_claim: string | null;
          p_token: string | null;
          p_status: string | null;
          p_ticket: string | null;
          p_error: string | null;
        };
        Returns: boolean;
      };
      inspect_invite: { Args: { p_token: string | null }; Returns: Json };
      invite: {
        Args: { p_space: string | null; p_role: string | null };
        Returns: Database["public"]["Tables"]["invitations"]["Row"];
      };
      leave_space: { Args: { p_space: string | null }; Returns: undefined };
      manage_member: {
        Args: {
          p_space: string | null;
          p_user: string | null;
          p_role: string | null;
        };
        Returns: undefined;
      };
      post_note: {
        Args: { p_record: string | null; p_body: string | null };
        Returns: undefined;
      };
      prepare_account_deletion: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      prepare_proposal: {
        Args: {
          p_review: string | null;
          p_request: string | null;
          p_body: Json | null;
          p_actions: Json | null;
        };
        Returns: string;
      };
      record_push_receipt: {
        Args: {
          p_job: string | null;
          p_token: string | null;
          p_ticket: string | null;
          p_outcome: string | null;
        };
        Returns: undefined;
      };
      reschedule_user: { Args: { p_user: string | null }; Returns: undefined };
      revoke_invite: { Args: { p_id: string | null }; Returns: undefined };
      save_record: {
        Args: {
          p_operation: string | null;
          p_record: Json | null;
          p_expected: number | null;
        };
        Returns: Json;
      };
      save_record_internal: {
        Args: {
          p_operation: string | null;
          p_record: Json | null;
          p_expected: number | null;
        };
        Returns: Json;
      };
      space_role: { Args: { s: string | null }; Returns: string };
      spawn_occurrence: {
        Args: {
          p_parent: string | null;
          p_revision: number | null;
          p_content: Json | null;
        };
        Returns: string;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
