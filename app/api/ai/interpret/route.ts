import { authenticate } from "../../../../src/supabase";
import { consumeRateLimit } from "../../../../src/database/rate-limits";
import { failure, success, json } from "../../../../src/libs/http";
import { interpretSchema } from "../../../../src/zod/ai";
import { recordSchema } from "../../../../src/zod/records";
import {
  findRecordsBySearchTerms,
  listContextRecords,
  listRecentRecords,
} from "../../../../src/database/records";
import { listSpaces } from "../../../../src/database/spaces";
import { listProfiles } from "../../../../src/database/profiles";
import { createReview } from "../../../../src/database/reviews";
import { boundedSources } from "../../../../src/libs/ai/domain";
import { interpretThought } from "../../../../src/libs/ai/interpret";
export const runtime = "nodejs";
export const POST = async (request: Request) => {
  const requestId = crypto.randomUUID(),
    start = Date.now();
  try {
    const { db, user } = await authenticate(request);
    await consumeRateLimit(user.id, "ai/interpret", 60);
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
    return success({ ...proposal, reviewId }, requestId, "ai/interpret", start);
  } catch (error) {
    return failure(error, requestId);
  }
};
