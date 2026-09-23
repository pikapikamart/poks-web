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
import { interpretSchema } from "@/zod/ai";
import { recordSchema } from "@/zod/records";
import {
  findRecordsBySearchTerms,
  listContextRecords,
  listRecentRecords,
} from "@/database/records";
import { listSpaces } from "@/database/spaces";
import { listProfiles } from "@/database/profiles";
import { createReview } from "@/database/reviews";
import { boundedSources } from "@/libs/ai/domain";
import { interpretThought } from "@/libs/ai/interpret";

export const runtime = "nodejs";

export const POST = withApiErrorHandling(
  "ai/interpret",
  async (request, context) => {
    const { db, user } = await authenticate(request);
    const rateLimit = await consumeRateLimit(
      getAuthenticatedRateLimitSubject(user.id),
      "ai-interpret",
      apiRateLimitPolicies["ai-interpret"],
    );
    assertRateLimit(rateLimit);
    const input = interpretSchema.parse(await json(request));

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

    const proposal = await interpretThought(input, records, spaces, people);
    const reviewId = await createReview(user.id, records);

    return success({ ...proposal, reviewId }, context, rateLimit);
  },
);
