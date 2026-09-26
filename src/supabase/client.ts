import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/database/types";
import { env } from "@/libs/env";

export const createAuthenticatedClient = (accessToken: string) =>
  createClient<Database>(env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
