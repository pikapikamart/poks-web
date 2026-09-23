import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./index";
export type DatabaseClient = SupabaseClient<Database>;
