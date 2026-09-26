import type { DatabaseClient } from "@/database/types/client";
import { checked } from "@/libs/database";

export const listContexts = async (db: DatabaseClient) => {
  return (
    checked(
      await db
        .from("contexts")
        .select("*")
        .eq("deleted", false)
        .order("updated_at", { ascending: false })
        .order("id")
        .limit(40),
    ) ?? []
  );
};

export const findContextsBySearchTerms = async (
  db: DatabaseClient,
  terms: string,
) => {
  return (
    checked(
      await db
        .from("contexts")
        .select("*")
        .eq("deleted", false)
        .textSearch("search_vector", terms, { type: "websearch" })
        .order("updated_at", { ascending: false })
        .order("id")
        .limit(40),
    ) ?? []
  );
};

export const findContextsByIds = async (db: DatabaseClient, ids: string[]) => {
  return ids.length
    ? (checked(await db.from("contexts").select("*").in("id", ids)) ?? [])
    : [];
};
