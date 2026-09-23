import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/database/types";
import { env } from "@/libs/env";

export const createServerClient = () =>
  createClient<Database>(env("SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
