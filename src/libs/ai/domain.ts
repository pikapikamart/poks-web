import type { z } from "zod";
import { DateTime } from "luxon";
import { modelProposalSchema } from "@/zod/ai";
import { contentSchema, type PoxEntry, type Mutation } from "@/zod/entries";
import { proposalSchema, type Proposal } from "@/zod/ai";
import { HttpError } from "@/libs/http";

export const boundedSources = (entries: PoxEntry[], limit = 80_000) => {
  let used = 0;

  return entries.filter((entry) => {
    const size = Buffer.byteLength(JSON.stringify(entry));

    if (used + size > limit) {
      return false;
    }

    used += size;

    return true;
  });
};

export const normalizeProposal = (
  raw: z.infer<typeof modelProposalSchema>,
  entries: PoxEntry[],
): Proposal => {
  if (raw.question) {
    return proposalSchema.parse({ ...raw, actions: [] });
  }

  return proposalSchema.parse({
    ...raw,
    actions: raw.actions.map((a) => {
      const source = entries.find((r) => r.id === a.targetId);

      if (
        a.kind === "update" &&
        (!source || source.deleted || source.kind !== a.entryKind)
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
        const template = entries.find(
          (r) => r.id === a.content.templateId && r.kind === "context",
        );

        if (!template || a.entryKind !== "instance") {
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
    action.entryKind === "context" ||
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

const requestsChecklist = (thought: string) =>
  /\b(checklist|check list|steps?|subtasks?|to[- ]do list|task list)\b/i.test(
    thought,
  );

const requestsIndividualCompletion = (thought: string) =>
  /\b(each|every)\s+(person|member|user)\b.{0,40}\b(own|separate|separately|individually|independent)\b|\b(everyone|people|members)\b.{0,30}\b(completes?|finishes?|checks?)\b.{0,20}\b(separately|individually|themselves)\b/i.test(
    thought,
  );

const requestsSharedCompletion = (thought: string) =>
  /\b(complete|finish|check)\s+(it\s+)?together\b|\bone\s+(completion|person)\b.{0,30}\b(for|counts? for)\s+everyone\b|\bshared\s+(completion|progress)\b/i.test(
    thought,
  );

export const correctReminderCompletionMode = (
  proposal: Proposal,
  thought: string,
  targetSpaceId?: string,
): Proposal => {
  const individual = requestsIndividualCompletion(thought);
  const shared = requestsSharedCompletion(thought);

  return {
    ...proposal,
    actions: proposal.actions.map((action) => {
      const spaceId = targetSpaceId ?? action.spaceId;

      return action.entryKind !== "context" && spaceId && individual !== shared
        ? {
          ...action,
          spaceId,
          completionMode: individual ? "individual" : "shared",
        }
        : { ...action, completionMode: undefined };
    }),
  };
};

export const removeUnrequestedReminderSteps = (
  proposal: Proposal,
  thought: string,
): Proposal => {
  if (requestsChecklist(thought)) {
    return proposal;
  }

  return {
    ...proposal,
    actions: proposal.actions.map((action) =>
      action.kind === "create" &&
      action.entryKind === "reminder" &&
      !action.content.templateId
        ? { ...action, content: { ...action.content, items: [] } }
        : action,
    ),
  };
};

export const correctTomorrowReminderDate = (
  proposal: Proposal,
  thought: string,
  referenceTime: string,
  timeZone: string,
): Proposal => {
  if (
    proposal.question ||
    proposal.actions.length !== 1 ||
    !/\btomorrow\b/i.test(thought) ||
    /\bday after tomorrow\b/i.test(thought)
  ) {
    return proposal;
  }

  const action = proposal.actions[0];

  if (action.kind !== "create" || action.entryKind === "context") {
    return proposal;
  }

  const today = DateTime.fromISO(referenceTime, { setZone: true }).setZone(
    timeZone,
  );
  const tomorrow = today.plus({ days: 1 });
  const todayDate = today.toISODate();
  const tomorrowDate = tomorrow.toISODate();

  if (action.content.dueAt) {
    const dueAt = DateTime.fromISO(action.content.dueAt, {
      setZone: true,
    }).setZone(timeZone);

    if (dueAt.toISODate() !== todayDate) {
      return proposal;
    }

    const corrected = dueAt.set({
      year: tomorrow.year,
      month: tomorrow.month,
      day: tomorrow.day,
    });

    return {
      ...proposal,
      actions: [
        {
          ...action,
          content: {
            ...action.content,
            dueAt: corrected.toISO({ suppressMilliseconds: true }),
            timeZone,
          },
        },
      ],
    };
  }

  if (action.content.dueDate !== todayDate) {
    return proposal;
  }

  return {
    ...proposal,
    actions: [
      {
        ...action,
        content: {
          ...action.content,
          dueDate: tomorrowDate,
          timeZone,
        },
      },
    ],
  };
};

export const correctExplicitReminderTime = (
  proposal: Proposal,
  thought: string,
  timeZone: string,
): Proposal => {
  const match = thought.match(
    /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i,
  );

  if (!match || proposal.question || proposal.actions.length !== 1) {
    return proposal;
  }

  const action = proposal.actions[0];

  if (action.entryKind === "context" || !action.content.dueAt) {
    return proposal;
  }

  const meridiem = match[3].toLowerCase().startsWith("p") ? "pm" : "am";
  const clockHour = Number(match[1]);
  const hour =
    meridiem === "pm"
      ? clockHour === 12
        ? 12
        : clockHour + 12
      : clockHour === 12
        ? 0
        : clockHour;
  const dueAt = DateTime.fromISO(action.content.dueAt, { setZone: true })
    .setZone(timeZone)
    .set({ hour, minute: Number(match[2] ?? 0), second: 0, millisecond: 0 })
    .toISO({ suppressMilliseconds: true });

  if (!dueAt) {
    return proposal;
  }

  return {
    ...proposal,
    actions: [
      {
        ...action,
        content: { ...action.content, dueAt, dueDate: null, timeZone },
      },
    ],
  };
};

export const defaultDatedReminderTimes = (
  proposal: Proposal,
  entries: PoxEntry[],
  timeZone: string,
): Proposal => {
  return {
    ...proposal,
    actions: proposal.actions.map((action) => {
      if (action.entryKind === "context" || !action.content.dueDate) {
        return action;
      }

      const source = entries.find((entry) => entry.id === action.targetId);

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
  sources: PoxEntry[],
  current: PoxEntry[],
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

      if (source.kind !== a.entryKind || source.space_id !== a.spaceId) {
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

    const completionMode =
      a.entryKind === "context" || !a.spaceId
        ? "shared"
        : (a.completionMode ?? source?.completion_mode ?? "shared");
    const content = contentSchema.parse(a.content);

    return {
      operationId: crypto.randomUUID(),
      expectedVersion: source?.version ?? 0,
      entry: {
        id: a.kind === "create" ? crypto.randomUUID() : source!.id,
        owner_id: source?.owner_id ?? userId,
        space_id: a.spaceId,
        kind: a.entryKind,
        content: {
          ...content,
          ...(a.entryKind === "context" ? {} : { completionMode }),
        },
        completion_mode: a.entryKind === "context" ? undefined : completionMode,
        version: source?.version ?? 0,
        updated_at: new Date().toISOString(),
        deleted: false,
      },
    };
  });
};
