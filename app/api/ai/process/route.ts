import { authenticate } from "@/supabase";
import { consumeRateLimit } from "@/database/rate-limits";
import { createReview } from "@/database/reviews";
import {
  findRecordsBySearchTerms,
  listContextRecords,
  listRecentRecords,
} from "@/libs/record-sources";
import { listSpaces } from "@/database/spaces";
import { listProfiles } from "@/database/profiles";
import {
  assertRateLimit,
  audio,
  HttpError,
  json,
  success,
  withApiErrorHandling,
} from "@/libs/http";
import {
  apiRateLimitPolicies,
  getAuthenticatedRateLimitSubject,
} from "@/libs/api/rate-limit";
import { boundedSources } from "@/libs/ai/domain";
import { buildActions } from "@/libs/ai/domain";
import { interpretThought } from "@/libs/ai/interpret";
import { transcribe } from "@/libs/ai/transcription";
import { prepareProposalSchema, interpretSchema } from "@/zod/ai";
import { recordSchema } from "@/zod/records";
import { createProposal, applyProposalById } from "@/database/proposals";
import { listSpaceMembersBySpaceId } from "@/database/space-members";

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
    const autoCommit =
      new URL(request.url).searchParams.get("autoCommit") === "1";
    const requestId = new URL(request.url).searchParams.get("requestId");
    const reviewed = { ...proposal, reviewId };

    if (
      autoCommit &&
      requestId &&
      !proposal.question &&
      proposal.actions.length
    ) {
      context.stage = "preparation";
      const prepared = prepareProposalSchema.parse({ ...reviewed, requestId });
      const actions = buildActions(prepared, records, records, user.id);

      for (const action of actions) {
        const record = action.record;

        if (record.space_id) {
          const members = await listSpaceMembersBySpaceId(db, record.space_id);
          const canEdit = members.some(
            (member) =>
              member.user_id === user.id &&
              ["owner", "editor"].includes(member.role),
          );
          const validAssignees = record.content.items.every(
            (item) =>
              !item.assignee ||
              members.some((member) => member.user_id === item.assignee),
          );

          if (!canEdit) {
            throw new HttpError(
              403,
              "You cannot edit this group.",
              "FORBIDDEN",
            );
          }

          if (!validAssignees) {
            throw new HttpError(
              400,
              "Choose a current group member for each assignment.",
              "INVALID_ASSIGNEE",
            );
          }
        } else if (
          record.content.items.some(
            (item) => item.assignee && item.assignee !== user.id,
          )
        ) {
          throw new HttpError(
            400,
            "Personal memories can only be assigned to you.",
            "INVALID_ASSIGNEE",
          );
        }
      }

      const proposalId = await createProposal(db, prepared, actions);

      if (!proposalId) {
        throw new HttpError(
          500,
          "Pox could not save that reminder.",
          "AI_UNRESOLVED",
        );
      }

      const saved = recordSchema
        .array()
        .parse(await applyProposalById(db, proposalId));

      context.stage = "response";

      return success(
        { ...reviewed, text: input.text, records: saved },
        context,
        rateLimit,
      );
    }

    context.stage = "response";

    return success({ ...reviewed, text: input.text }, context, rateLimit);
  },
);
