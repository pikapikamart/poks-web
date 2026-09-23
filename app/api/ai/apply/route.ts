import { authenticate } from "../../../../src/supabase";
import { consumeRateLimit } from "../../../../src/database/rate-limits";
import {
  assertRateLimit,
  json,
  success,
  withApiErrorHandling,
} from "../../../../src/libs/http";
import {
  apiRateLimitPolicies,
  getAuthenticatedRateLimitSubject,
} from "../../../../src/libs/api/rate-limit";
import { recordSchema } from "../../../../src/zod/records";
import { applyProposalSchema } from "../../../../src/zod/ai";
import { applyProposalById } from "../../../../src/database/proposals";

export const runtime = "nodejs";

export const POST = withApiErrorHandling(
  "ai/apply",
  async (request, context) => {
    const { db, user } = await authenticate(request);
    const rateLimit = await consumeRateLimit(
      getAuthenticatedRateLimitSubject(user.id),
      "ai-apply",
      apiRateLimitPolicies["ai-apply"],
    );
    assertRateLimit(rateLimit);
    const { id } = applyProposalSchema.parse(await json(request));
    const records = recordSchema.array().parse(await applyProposalById(db, id));

    return success({ records }, context, rateLimit);
  },
);
