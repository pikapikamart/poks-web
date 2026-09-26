import type { DatabaseClient } from "@/database/types/client";
import { checked } from "@/libs/database";

const selection = "*,context_reminders(context_id),space_reminders(space_id)";

export const listRecentReminders = async (db: DatabaseClient) => {
  return (
    checked(
      await db
        .from("reminders")
        .select(selection)
        .eq("deleted", false)
        .order("updated_at", { ascending: false })
        .order("id")
        .limit(30),
    ) ?? []
  );
};

export const findRemindersBySearchTerms = async (
  db: DatabaseClient,
  terms: string,
) => {
  return (
    checked(
      await db
        .from("reminders")
        .select(selection)
        .eq("deleted", false)
        .textSearch("search_vector", terms, { type: "websearch" })
        .order("updated_at", { ascending: false })
        .order("id")
        .limit(80),
    ) ?? []
  );
};

export const findRemindersByIds = async (db: DatabaseClient, ids: string[]) => {
  return ids.length
    ? (checked(await db.from("reminders").select(selection).in("id", ids)) ??
        [])
    : [];
};
