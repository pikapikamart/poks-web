import { authenticate } from "../../../../src/supabase";
import { consumeRateLimit } from "../../../../src/database/rate-limits";
import { failure, success, json } from "../../../../src/libs/http";
import { recordSchema } from "../../../../src/zod/records";
import { applyProposalSchema } from "../../../../src/zod/ai";
import { applyProposalById } from "../../../../src/database/proposals";

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  const requestId = crypto.randomUUID(),
    start = Date.now();

  try {
    const { db, user } = await authenticate(request);
    await consumeRateLimit(user.id, "ai/apply", 60);
    const { id } = applyProposalSchema.parse(await json(request));
    const records = recordSchema.array().parse(await applyProposalById(db, id));

    return success({ records }, requestId, "ai/apply", start);
  } catch (error) {
    return failure(error, requestId);
  }
};
