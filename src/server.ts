import type { Database } from "@pox/contracts/src/database";
import { createClient } from "@supabase/supabase-js";
import { HttpError } from "./http";
export { HttpError, failure, json } from "./http";
export function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
export function admin() {
  return createClient<Database>(
    env("SUPABASE_URL"),
    env("SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
export async function authenticate(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token)
    throw new HttpError(401, "Sign in to continue.", "UNAUTHENTICATED");
  const db = createClient<Database>(
    env("SUPABASE_URL"),
    env("SUPABASE_PUBLISHABLE_KEY"),
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    throw new HttpError(
      401,
      "Your session expired. Please sign in again.",
      "UNAUTHENTICATED",
    );
  return { db, user: data.user };
}
export async function limited(userId: string, bucket: string, max = 60) {
  const { data, error } = await admin().rpc("consume_rate", {
    p_user: userId,
    p_bucket: bucket,
    p_max: max,
  });
  if (error) throw error;
  if (!data)
    throw new HttpError(
      429,
      "Please take a moment before trying again.",
      "RATE_LIMITED",
    );
}
