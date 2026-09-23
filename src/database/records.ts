import type { DatabaseClient } from "@/database/types/client";
import { checked } from "@/libs/database";

export const findRecordsBySearchTerms = async (
  db: DatabaseClient,
  terms: string,
) => {
  return (
    checked(
      await db
        .from("records")
        .select("*")
        .eq("deleted", false)
        .textSearch("search_vector", terms, { type: "websearch" })
        .order("updated_at", { ascending: false })
        .order("id")
        .limit(80),
    ) ?? []
  );
};

export const listContextRecords = async (db: DatabaseClient) => {
  return (
    checked(
      await db
        .from("records")
        .select("*")
        .eq("deleted", false)
        .eq("kind", "context")
        .order("updated_at", { ascending: false })
        .order("id")
        .limit(40),
    ) ?? []
  );
};

export const listRecentRecords = async (db: DatabaseClient) => {
  return (
    checked(
      await db
        .from("records")
        .select("*")
        .eq("deleted", false)
        .order("updated_at", { ascending: false })
        .order("id")
        .limit(30),
    ) ?? []
  );
};

export const findRecordsByIds = async (db: DatabaseClient, ids: string[]) => {
  return ids.length
    ? (checked(await db.from("records").select("*").in("id", ids)) ?? [])
    : [];
};
