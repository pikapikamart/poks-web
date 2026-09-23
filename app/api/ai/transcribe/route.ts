import { authenticate } from "../../../../src/supabase";
import { consumeRateLimit } from "../../../../src/database/rate-limits";
import { failure, success, audio } from "../../../../src/libs/http";
import { transcribe } from "../../../../src/libs/ai/transcription";

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  const requestId = crypto.randomUUID(),
    start = Date.now();

  try {
    const { user } = await authenticate(request);
    await consumeRateLimit(user.id, "ai/transcribe", 30);
    const file = await audio(request);
    const text = await transcribe(file);

    return success({ text }, requestId, "ai/transcribe", start);
  } catch (error) {
    return failure(error, requestId);
  }
};
