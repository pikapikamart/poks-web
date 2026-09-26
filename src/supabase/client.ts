import { createClient } from "@supabase/supabase-js";
import type { AppDatabase } from "@/database/types/schema";
import { env } from "@/libs/env";

export const createAuthenticatedClient = (accessToken: string) =>
  createClient<AppDatabase>(
    env("SUPABASE_URL"),
    env("SUPABASE_PUBLISHABLE_KEY"),
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
