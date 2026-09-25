import { authenticate } from "@/supabase";
import { consumeRateLimit } from "@/database/rate-limits";
import { createReview } from "@/database/reviews";
import {
  findRecordsBySearchTerms,
  listContextRecords,
  listRecentRecords,
} from "@/database/records";
import { listSpaces } from "@/database/spaces";
import { listProfiles } from "@/database/profiles";
import {
  assertRateLimit,
  audio,
  json,
  success,
  withApiErrorHandling,
} from "@/libs/http";
import {
  apiRateLimitPolicies,
  getAuthenticatedRateLimitSubject,
} from "@/libs/api/rate-limit";
import { boundedSources } from "@/libs/ai/domain";
import { interpretThought } from "@/libs/ai/interpret";
import { transcribe } from "@/libs/ai/transcription";
import { interpretSchema } from "@/zod/ai";
import { recordSchema } from "@/zod/records";

export const POST = withApiErrorHandling(
  "ai/process",
  async (request, context) => {
    context.stage = "authentication";
    const { db, user } = await authenticate(request);
    context.stage = "rate_limit";
    const rateLimit = await consumeRateLimit(
      getAuthenticatedRateLimitSubject(user.id),
      "ai-process",
      apiRateLimitPolicies["ai-process"],
    );
    assertRateLimit(rateLimit);

    const contentType =
      request.headers.get("content-type")?.split(";")[0].toLowerCase() ?? "";
    let input: ReturnType<typeof interpretSchema.parse>;

    if (contentType === "application/json") {
      context.stage = "input_parse";
      input = interpretSchema.parse(await json(request));
    } else {
      context.stage = "audio_parse";
      const file = await audio(request);
      context.stage = "transcription";
      const text = await transcribe(file);
      const url = new URL(request.url);
      input = interpretSchema.parse({
        text,
        timeZone: url.searchParams.get("timeZone"),
        referenceTime: url.searchParams.get("referenceTime"),
      });
    }

    context.stage = "source_lookup";
    const terms =
      (input.text + " " + (input.clarification ?? ""))
        .match(/[\p{L}\p{N}]+/gu)
        ?.slice(0, 40)
        .join(" OR ") ?? "";
    const [matching, contexts, recent, spaces, people] = await Promise.all([
      findRecordsBySearchTerms(db, terms),
      listContextRecords(db),
      listRecentRecords(db),
      listSpaces(db),
      listProfiles(db),
    ]);
    const records = boundedSources([
      ...new Map(
        [...matching, ...contexts, ...recent].map((row) => {
          const record = recordSchema.parse(row);

          return [record.id, record] as const;
        }),
      ).values(),
    ]);

    context.stage = "interpretation";
    const proposal = await interpretThought(input, records, spaces, people);
    context.stage = "review";
    const reviewId = await createReview(user.id, records);
    context.stage = "response";

    return success(
      { ...proposal, reviewId, text: input.text },
      context,
      rateLimit,
    );
  },
);
