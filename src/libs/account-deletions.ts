import {
  deleteAccountData,
  listPendingAccountDeletions,
  updateAccountDeletionError,
} from "@/database/account-deletions";
import { deleteUserById } from "@/database/users";

export const completeAccountDeletion = async (userId: string) => {
  await deleteAccountData(userId);

  const { error } = await deleteUserById(userId);

  if (error) {
    await updateAccountDeletionError(userId, "AUTH_DELETION_FAILED");
    throw error;
  }
};

export const retryPendingAccountDeletions = async () => {
  const accountDeletions = await listPendingAccountDeletions();

  for (const accountDeletion of accountDeletions) {
    try {
      await completeAccountDeletion(accountDeletion.user_id);
    } catch {
      console.error(JSON.stringify({ event: "account_deletion_retry_failed" }));
    }
  }
};
