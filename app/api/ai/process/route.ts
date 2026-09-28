import { authenticate } from "@/supabase";
import { consumeRateLimit } from "@/database/rate-limits";
import {
  applyAiOperation,
  findAiOperationByRequestId,
} from "@/database/ai-operations";
import {
  findRecordsBySearchTerms,
  findRecordsByIds,
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
import { interpretSchema, proposalSchema } from "@/zod/ai";
import { recordSchema } from "@/zod/records";
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
      console.log(text);
      const url = new URL(request.url);
      input = interpretSchema.parse({
        requestId: url.searchParams.get("requestId"),
        text,
        timeZone: url.searchParams.get("timeZone"),
        referenceTime: url.searchParams.get("referenceTime"),
        targetRecordId: url.searchParams.get("targetRecordId") ?? undefined,
      });
    }

    context.stage = "idempotency";
    const existing = await findAiOperationByRequestId(user.id, input.requestId);

    if (existing) {
      const originalInput = interpretSchema.parse(existing.request_body);

      if (JSON.stringify(originalInput) !== JSON.stringify(input)) {
        throw new HttpError(
          409,
          "This request ID was already used for another thought.",
          "IDEMPOTENCY_CONFLICT",
        );
      }

      if (existing.status !== "completed" || !existing.result) {
        throw new HttpError(
          409,
          "This thought is still being processed. Try again.",
          "OPERATION_INCOMPLETE",
        );
      }

      const savedProposal = proposalSchema.parse(existing.proposal);
      const savedRecords = recordSchema.array().parse(existing.result);

      return success(
        { ...savedProposal, text: input.text, records: savedRecords },
        context,
        rateLimit,
      );
    }

    context.stage = "source_lookup";
    const terms =
      (input.text + " " + (input.clarification ?? ""))
        .match(/[\p{L}\p{N}]+/gu)
        ?.slice(0, 40)
        .join(" OR ") ?? "";
    const [matching, contexts, recent, spaces, people] = await Promise.all([
      input.targetRecordId
        ? findRecordsByIds(db, [input.targetRecordId])
        : findRecordsBySearchTerms(db, terms),
      input.targetRecordId ? Promise.resolve([]) : listContextRecords(db),
      input.targetRecordId ? Promise.resolve([]) : listRecentRecords(db),
      listSpaces(db),
      listProfiles(db),
    ]);

    if (
      input.targetRecordId &&
      !matching.some(
        (row) =>
          row.id === input.targetRecordId &&
          !row.deleted &&
          row.kind !== "context",
      )
    ) {
      throw new HttpError(
        404,
        "This reminder is no longer available to edit.",
        "INVALID_AI_TARGET",
      );
    }

    const target = input.targetRecordId
      ? recordSchema.parse(
        matching.find((row) => row.id === input.targetRecordId),
      )
      : null;
    const linkedContext = target?.content.templateId
      ? await findRecordsByIds(db, [target.content.templateId])
      : [];

    const records = boundedSources([
      ...new Map(
        [...matching, ...linkedContext, ...contexts, ...recent].map((row) => {
          const record = recordSchema.parse(row);

          return [record.id, record] as const;
        }),
      ).values(),
    ]);

    context.stage = "interpretation";
    const proposal = await interpretThought(input, records, spaces, people);

    if (
      input.targetRecordId &&
      !proposal.question &&
      (proposal.actions.length !== 1 ||
        proposal.actions[0].kind !== "update" ||
        proposal.actions[0].targetId !== input.targetRecordId)
    ) {
      throw new HttpError(
        422,
        "Please record a change to this reminder.",
        "INVALID_AI_TARGET",
      );
    }

    if (!proposal.question && proposal.actions.length) {
      context.stage = "application";
      const actions = buildActions(proposal, records, records, user.id);

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

      const saved = recordSchema
        .array()
        .parse(
          await applyAiOperation(
            db,
            input.requestId,
            input,
            proposal,
            records,
            actions,
          ),
        );

      context.stage = "response";

      return success(
        { ...proposal, text: input.text, records: saved },
        context,
        rateLimit,
      );
    }

    context.stage = "response";

    return success({ ...proposal, text: input.text }, context, rateLimit);
  },
);
