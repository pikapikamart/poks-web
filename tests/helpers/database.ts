import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
export const alice = "00000000-0000-4000-8000-000000000001",
  bob = "00000000-0000-4000-8000-000000000002";
export const database = async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,service_role;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;insert into auth.users values('${alice}'),('${bob}');`,
  );
  for (const file of readdirSync("supabase/migrations").sort()) {
    try {
      await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    } catch (error) {
      await db.close();
      throw new Error(`Migration failed: ${file}`, { cause: error });
    }
  }
  return db;
};

export const asUser = async (db: PGlite, user = alice) => {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${user}',false)`,
  );
};

export const asAdmin = async (db: PGlite) => {
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',false)",
  );
};
