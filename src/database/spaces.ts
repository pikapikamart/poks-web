import type { DatabaseClient } from "@/database/types/client";
import { checked } from "@/libs/database";

export const listSpaces = async (db: DatabaseClient) => {
  return (
    checked(await db.from("spaces").select("id,name").order("id").limit(100)) ??
    []
  );
};
