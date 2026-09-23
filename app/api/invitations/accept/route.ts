import { authenticate } from "@/supabase";
import { consumeRateLimit } from "@/database/rate-limits";
import {
  assertRateLimit,
  json,
  success,
  withApiErrorHandling,
} from "@/libs/http";
import {
  apiRateLimitPolicies,
  getAuthenticatedRateLimitSubject,
} from "@/libs/api/rate-limit";
import { uuid } from "@/zod/common";
import { acceptInvitationSchema } from "@/zod/invitations";
import { acceptInvitation } from "@/database/invitations";

export const runtime = "nodejs";

export const POST = withApiErrorHandling(
  "invitations/accept",
  async (request, context) => {
    const { db, user } = await authenticate(request);
    const rateLimit = await consumeRateLimit(
      getAuthenticatedRateLimitSubject(user.id),
      "invitation-accept",
      apiRateLimitPolicies["invitation-accept"],
    );
    assertRateLimit(rateLimit);
    const { token } = acceptInvitationSchema.parse(await json(request));
    const spaceId = uuid.parse(await acceptInvitation(db, token));

    return success({ spaceId }, context, rateLimit);
  },
);
