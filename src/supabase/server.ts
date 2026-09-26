import { createClient } from "@supabase/supabase-js";
import type { AppDatabase } from "@/database/types/schema";
import { env } from "@/libs/env";

export const createServerClient = () =>
  createClient<AppDatabase>(env("SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
