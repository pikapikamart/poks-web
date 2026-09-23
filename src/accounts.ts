import { admin } from "./server";
import { databaseError } from "./http";

export async function finishAccountDeletion(userId: string) {
  const db = admin();
  const { error: cleanup } = await db.rpc("cleanup_account", {
    p_user: userId,
  });
  if (cleanup) databaseError(cleanup);
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    await db
      .from("account_deletions")
      .update({ last_error: "AUTH_DELETION_FAILED" })
      .eq("user_id", userId);
    throw error;
  }
}
export async function retryAccountDeletions() {
  const { data, error } = await admin()
    .from("account_deletions")
    .select("user_id")
    .order("created_at")
    .limit(25);
  if (error) throw error;
  for (const row of data ?? []) {
    try {
      await finishAccountDeletion(row.user_id);
    } catch {
      console.error(JSON.stringify({ event: "account_deletion_retry_failed" }));
    }
  }
}
