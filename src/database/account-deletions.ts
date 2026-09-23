import { databaseError } from "@/libs/http";
import { createServerClient } from "@/supabase";
import type { DatabaseClient } from "@/database/types/client";
import { checked } from "@/libs/database";

export const createAccountDeletion = async (db: DatabaseClient) => {
  const { error } = await db.rpc("prepare_account_deletion");

  if (error) {
    databaseError(error);
  }
};

export const listPendingAccountDeletions = async () => {
  const { data, error } = await createServerClient()
    .from("account_deletions")
    .select("user_id")
    .order("created_at")
    .limit(25);

  return checked({ data: data ?? [], error });
};

export const updateAccountDeletionError = async (
  userId: string,
  errorCode: string,
) =>
  checked(
    await createServerClient()
      .from("account_deletions")
      .update({ last_error: errorCode })
      .eq("user_id", userId),
  );

export const deleteAccountData = async (userId: string) => {
  const { error } = await createServerClient().rpc("cleanup_account", {
    p_user: userId,
  });

  if (error) {
    databaseError(error);
  }
};
