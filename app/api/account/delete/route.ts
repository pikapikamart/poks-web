import { authenticate } from "../../../../src/supabase";
import { consumeRateLimit } from "../../../../src/database/rate-limits";
import {
  assertRateLimit,
  HttpError,
  json,
  success,
  withApiErrorHandling,
} from "../../../../src/libs/http";
import {
  apiRateLimitPolicies,
  getAuthenticatedRateLimitSubject,
} from "../../../../src/libs/api/rate-limit";
import { deleteAccountSchema } from "../../../../src/zod/accounts";
import { createAccountDeletion } from "../../../../src/database/account-deletions";
import { completeAccountDeletion } from "../../../../src/libs/account-deletions";

export const runtime = "nodejs";

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
