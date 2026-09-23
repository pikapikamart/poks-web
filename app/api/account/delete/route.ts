import { authenticate } from "@/supabase";
import { consumeRateLimit } from "@/database/rate-limits";
import {
  assertRateLimit,
  HttpError,
  json,
  success,
  withApiErrorHandling,
} from "@/libs/http";
import {
  apiRateLimitPolicies,
  getAuthenticatedRateLimitSubject,
} from "@/libs/api/rate-limit";
import { deleteAccountSchema } from "@/zod/accounts";
import { createAccountDeletion } from "@/database/account-deletions";
import { completeAccountDeletion } from "@/libs/account-deletions";

export const POST = withApiErrorHandling(
  "account/delete",
  async (request, context) => {
    const { db, user } = await authenticate(request);
    const rateLimit = await consumeRateLimit(
      getAuthenticatedRateLimitSubject(user.id),
      "account-delete",
      apiRateLimitPolicies["account-delete"],
    );
    assertRateLimit(rateLimit);
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

    return success({ deleted: true }, context, rateLimit);
  },
);
