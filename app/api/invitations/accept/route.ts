import { authenticate } from "../../../../src/supabase";
import { consumeRateLimit } from "../../../../src/database/rate-limits";
import { failure, success, json } from "../../../../src/libs/http";
import { uuid } from "../../../../src/zod/common";
import { acceptInvitationSchema } from "../../../../src/zod/invitations";
import { acceptInvitation } from "../../../../src/database/invitations";

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  const requestId = crypto.randomUUID(),
    start = Date.now();

  try {
    const { db, user } = await authenticate(request);
    await consumeRateLimit(user.id, "invitations/accept", 60);
    const { token } = acceptInvitationSchema.parse(await json(request));
    const spaceId = uuid.parse(await acceptInvitation(db, token));

    return success({ spaceId }, requestId, "invitations/accept", start);
  } catch (error) {
    return failure(error, requestId);
  }
};
