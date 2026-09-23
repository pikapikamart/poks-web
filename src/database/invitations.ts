import type { DatabaseClient } from "@/database/types/client";
import { databaseError } from "@/libs/http";

export const acceptInvitation = async (db: DatabaseClient, token: string) => {
  const { data, error } = await db.rpc("accept_invite", { p_token: token });

  if (error) {
    databaseError(error);
  }

  return data;
};
