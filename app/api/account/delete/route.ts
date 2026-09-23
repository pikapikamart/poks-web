import { authenticate } from "../../../../src/supabase";
import { consumeRateLimit } from "../../../../src/database/rate-limits";
import { failure, success, json, HttpError } from "../../../../src/libs/http";
import { deleteAccountSchema } from "../../../../src/zod/accounts";
import { createAccountDeletion } from "../../../../src/database/account-deletions";
import { completeAccountDeletion } from "../../../../src/libs/account-deletions";
export const runtime = "nodejs";
export const POST = async (request: Request) => {
  const requestId = crypto.randomUUID(),
    start = Date.now();
  try {
    const { db, user } = await authenticate(request);
    await consumeRateLimit(user.id, "account/delete", 60);
    deleteAccountSchema.parse(await json(request));
    await createAccountDeletion(db);
    try {
      await completeAccountDeletion(user.id);
    } catch {
      throw new HttpError(
        503,
        "Account deletion is queued and will be retried automatically.",
        "DELETION_PENDING",
      );
    }
    return success({ deleted: true }, requestId, "account/delete", start);
  } catch (error) {
    return failure(error, requestId);
  }
};
