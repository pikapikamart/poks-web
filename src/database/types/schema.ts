import type { Database, Json } from "@/database/types";

type CurrentTables = Database["public"]["Tables"];

type AiOperationsTable = {
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
  Update: Partial<AiOperationsTable["Insert"]>;
  Relationships: [];
};

type FinalTables = Omit<
  CurrentTables,
  | "activity"
  | "ai_proposals"
  | "ai_reviews"
  | "deliveries"
  | "device_deliveries"
  | "devices"
  | "inbox"
  | "operations"
  | "outbox"
  | "recurrences"
> & {
  ai_operations: AiOperationsTable;
  collaboration_activity: CurrentTables["activity"];
  notification_deliveries: CurrentTables["deliveries"];
  notification_device_deliveries: CurrentTables["device_deliveries"];
  notification_devices: CurrentTables["devices"];
  notification_inbox: CurrentTables["inbox"];
  reminder_operations: CurrentTables["operations"];
  reminder_outbox: CurrentTables["outbox"];
  reminder_recurrences: CurrentTables["recurrences"];
};

export type AppDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: FinalTables;
    Functions: Database["public"]["Functions"] & {
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
    };
  };
};
