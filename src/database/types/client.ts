import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppDatabase } from "@/database/types/schema";

export type DatabaseClient = SupabaseClient<AppDatabase>;
