import { authenticate } from "@/supabase";
import { consumeRateLimit } from "@/database/rate-limits";
import {
  assertRateLimit,
  audio,
  success,
  withApiErrorHandling,
} from "@/libs/http";
import {
  apiRateLimitPolicies,
  getAuthenticatedRateLimitSubject,
} from "@/libs/api/rate-limit";
import { transcribe } from "@/libs/ai/transcription";

export const POST = withApiErrorHandling(
  "ai/transcribe",
  async (request, context) => {
    context.stage = "authentication";
    const { user } = await authenticate(request);
    context.stage = "rate_limit";
    const rateLimit = await consumeRateLimit(
      getAuthenticatedRateLimitSubject(user.id),
      "ai-transcribe",
      apiRateLimitPolicies["ai-transcribe"],
    );
    assertRateLimit(rateLimit);
    context.stage = "audio_parse";
    const file = await audio(request);
    context.stage = "transcription";
    const text = await transcribe(file);
    context.stage = "response";

    return success({ text }, context, rateLimit);
  },
);
