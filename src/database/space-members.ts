import type { DatabaseClient } from "@/database/types/client";
import { checked } from "@/libs/database";

export const listSpaceMembersBySpaceId = async (
  db: DatabaseClient,
  spaceId: string,
) =>
  checked(
    await db
      .from("space_members")
      .select("user_id,role")
      .eq("space_id", spaceId),
  ) ?? [];
