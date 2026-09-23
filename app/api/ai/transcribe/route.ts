import { authenticate } from "../../../../src/supabase";
import { consumeRateLimit } from "../../../../src/database/rate-limits";
import {
  assertRateLimit,
  audio,
  success,
  withApiErrorHandling,
} from "../../../../src/libs/http";
import {
  apiRateLimitPolicies,
  getAuthenticatedRateLimitSubject,
} from "../../../../src/libs/api/rate-limit";
import { transcribe } from "../../../../src/libs/ai/transcription";

export const runtime = "nodejs";

export const POST = withApiErrorHandling(
  "ai/transcribe",
  async (request, context) => {
    const { user } = await authenticate(request);
    const rateLimit = await consumeRateLimit(
      getAuthenticatedRateLimitSubject(user.id),
      "ai-transcribe",
      apiRateLimitPolicies["ai-transcribe"],
    );
    assertRateLimit(rateLimit);
    const file = await audio(request);
    const text = await transcribe(file);

    return success({ text }, context, rateLimit);
  },
);
