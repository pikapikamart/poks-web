import type { DatabaseClient } from "./types/client";
import { checked } from "../libs/database";
export const listProfiles = async (db: DatabaseClient) => {
  return (
    checked(
      await db
        .from("profiles")
        .select("id,display_name")
        .order("id")
        .limit(200),
    ) ?? []
  );
};
