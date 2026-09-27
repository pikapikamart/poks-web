import type { z } from "zod";
import { DateTime } from "luxon";
import { modelProposalSchema } from "@/zod/ai";
import { contentSchema, type PoxRecord, type Mutation } from "@/zod/records";
import { proposalSchema, type Proposal } from "@/zod/ai";
import { HttpError } from "@/libs/http";

export const boundedSources = (records: PoxRecord[], limit = 80_000) => {
  let used = 0;

  return records.filter((record) => {
    const size = Buffer.byteLength(JSON.stringify(record));

    if (used + size > limit) {
      return false;
    }

    used += size;

    return true;
  });
};

export const normalizeProposal = (
  raw: z.infer<typeof modelProposalSchema>,
  records: PoxRecord[],
): Proposal => {
  if (raw.question) {
    return proposalSchema.parse({ ...raw, actions: [] });
  }

  return proposalSchema.parse({
    ...raw,
    actions: raw.actions.map((a) => {
      const source = records.find((r) => r.id === a.targetId);

      if (
        a.kind === "update" &&
        (!source || source.deleted || source.kind !== a.recordKind)
      ) {
        throw new HttpError(
          422,
          "Choose an available memory to update.",
          "INVALID_AI_TARGET",
        );
      }

      const knownIds = new Set(source?.content.items.map((i) => i.id));
      let items = a.content.items.map((i) => ({
        ...i,
        id: i.id && knownIds.has(i.id) ? i.id : crypto.randomUUID(),
      }));

      if (a.kind === "create" && a.content.templateId) {
        const template = records.find(
          (r) => r.id === a.content.templateId && r.kind === "context",
        );

        if (!template || a.recordKind !== "instance") {
          throw new HttpError(
            422,
            "Choose an available Context.",
            "INVALID_AI_TEMPLATE",
          );
        }

        items = template.content.items.map((i) => ({
          ...i,
          id: crypto.randomUUID(),
          completed: false,
        }));
      }

      return {
        ...a,
        targetId: a.kind === "create" ? null : a.targetId,
        content: { ...a.content, items },
      };
    }),
  });
};

export const fillNewReminderNotes = (
  proposal: Proposal,
  thought: string,
): Proposal => {
  if (proposal.actions.length !== 1) {
    return proposal;
  }

  const action = proposal.actions[0];

  if (
    action.kind !== "create" ||
    action.recordKind === "context" ||
    action.content.notes.trim()
  ) {
    return proposal;
  }

  return {
    ...proposal,
    actions: [
      {
        ...action,
        content: { ...action.content, notes: thought.trim() },
      },
    ],
  };
};

export const defaultDatedReminderTimes = (
  proposal: Proposal,
  records: PoxRecord[],
  timeZone: string,
): Proposal => {
  return {
    ...proposal,
    actions: proposal.actions.map((action) => {
      if (action.recordKind === "context" || !action.content.dueDate) {
        return action;
      }

      const source = records.find((record) => record.id === action.targetId);

      if (
        action.kind === "update" &&
        source?.content.dueDate === action.content.dueDate
      ) {
        return action;
      }

      const dueAt = DateTime.fromISO(action.content.dueDate, {
        zone: timeZone,
      })
        .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
        .toISO({ suppressMilliseconds: true });

      if (!dueAt) {
        throw new HttpError(
          422,
          "Choose a valid reminder date.",
          "INVALID_AI_DATE",
        );
      }

      return {
        ...action,
        content: {
          ...action.content,
          dueAt,
          dueDate: null,
          timeZone,
        },
      };
    }),
  };
};

export const buildActions = (
  proposal: Proposal,
  sources: PoxRecord[],
  current: PoxRecord[],
  userId: string,
): Mutation[] => {
  const seen = new Set<string>();

  return proposal.actions.map((a) => {
    const source = sources.find((r) => r.id === a.targetId);
    const latest = current.find((r) => r.id === a.targetId);

    if (a.kind === "update") {
      if (!source || !latest || latest.deleted) {
        throw new HttpError(
          403,
          "That memory is no longer available.",
          "FORBIDDEN",
        );
      }

      if (source.version !== latest.version) {
        throw new HttpError(
          409,
          "This changed while you were reviewing it.",
          "CONFLICT",
        );
      }

      if (source.kind !== a.recordKind || source.space_id !== a.spaceId) {
        throw new HttpError(
          400,
          "Change sharing separately before using AI.",
          "INVALID_TARGET",
        );
      }

      if (seen.has(source.id)) {
        throw new HttpError(
          400,
          "Review one change per memory.",
          "DUPLICATE_TARGET",
        );
      }

      seen.add(source.id);
    }

    if (a.content.templateId) {
      const template = sources.find((r) => r.id === a.content.templateId);
      const now = current.find((r) => r.id === a.content.templateId);

      if (!template || template.kind !== "context" || !now || now.deleted) {
        throw new HttpError(
          403,
          "That Context is no longer available.",
          "FORBIDDEN",
        );
      }

      if (template.version !== now.version) {
        throw new HttpError(
          409,
          "That Context changed. Review it again.",
          "CONFLICT",
        );
      }
    }

    return {
      operationId: crypto.randomUUID(),
      expectedVersion: source?.version ?? 0,
      record: {
        id: a.kind === "create" ? crypto.randomUUID() : source!.id,
        owner_id: source?.owner_id ?? userId,
        space_id: a.spaceId,
        kind: a.recordKind,
        content: contentSchema.parse(a.content),
        version: source?.version ?? 0,
        updated_at: new Date().toISOString(),
        deleted: false,
      },
    };
  });
};
