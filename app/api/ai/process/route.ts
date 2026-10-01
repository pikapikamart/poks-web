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
} from "@/libs/entry-sources";
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
import { entrySchema } from "@/zod/entries";
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
        targetEntryId: url.searchParams.get("targetEntryId") ?? undefined,
        targetSpaceId: url.searchParams.get("targetSpaceId") ?? undefined,
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
      const savedRecords = entrySchema.array().parse(existing.result);

      return success(
        { ...savedProposal, text: input.text, entries: savedRecords },
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
      input.targetEntryId
        ? findRecordsByIds(db, [input.targetEntryId])
        : findRecordsBySearchTerms(db, terms),
      input.targetEntryId ? Promise.resolve([]) : listContextRecords(db),
      input.targetEntryId ? Promise.resolve([]) : listRecentRecords(db),
      listSpaces(db),
      listProfiles(db),
    ]);

    if (
      input.targetEntryId &&
      !matching.some(
        (row) =>
          row.id === input.targetEntryId &&
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

    const target = input.targetEntryId
      ? entrySchema.parse(
        matching.find((row) => row.id === input.targetEntryId),
      )
      : null;
    const linkedContext = target?.content.templateId
      ? await findRecordsByIds(db, [target.content.templateId])
      : [];

    const entries = boundedSources([
      ...new Map(
        [...matching, ...linkedContext, ...contexts, ...recent].map((row) => {
          const entry = entrySchema.parse(row);

          return [entry.id, entry] as const;
        }),
      ).values(),
    ]);

    context.stage = "interpretation";
    const interpreted = await interpretThought(input, entries, spaces, people);
    const proposal = input.targetSpaceId
      ? {
        ...interpreted,
        actions: interpreted.actions.map((action) =>
          action.kind === "create"
            ? { ...action, spaceId: input.targetSpaceId! }
            : action,
        ),
      }
      : interpreted;

    if (
      input.targetSpaceId &&
      !spaces.some((space) => space.id === input.targetSpaceId)
    ) {
      throw new HttpError(403, "You cannot edit this Space.", "FORBIDDEN");
    }

    if (
      input.targetEntryId &&
      !proposal.question &&
      (proposal.actions.length !== 1 ||
        proposal.actions[0].kind !== "update" ||
        proposal.actions[0].targetId !== input.targetEntryId)
    ) {
      throw new HttpError(
        422,
        "Please entry a change to this reminder.",
        "INVALID_AI_TARGET",
      );
    }

    if (!proposal.question && proposal.actions.length) {
      context.stage = "application";
      const actions = buildActions(proposal, entries, entries, user.id);

      for (const action of actions) {
        const entry = action.entry;

        if (entry.space_id) {
          const members = await listSpaceMembersBySpaceId(db, entry.space_id);
          const canEdit = members.some(
            (member) =>
              member.user_id === user.id &&
              ["owner", "editor"].includes(member.role),
          );
          const validAssignees = entry.content.items.every(
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
          entry.content.items.some(
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

      const saved = entrySchema
        .array()
        .parse(
          await applyAiOperation(
            db,
            input.requestId,
            input,
            proposal,
            entries,
            actions,
          ),
        );

      context.stage = "response";

      return success(
        { ...proposal, text: input.text, entries: saved },
        context,
        rateLimit,
      );
    }

    context.stage = "response";

    return success({ ...proposal, text: input.text }, context, rateLimit);
  },
);
