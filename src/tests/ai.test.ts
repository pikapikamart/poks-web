import { modelProposalSchema } from "@/zod/ai";
import test from "node:test";
import assert from "node:assert/strict";
import { zodTextFormat } from "openai/helpers/zod";
import { blankContent } from "@/libs/records";
import { type PoxRecord } from "@/zod/records";
import { type Proposal } from "@/zod/ai";
import {
  normalizeProposal,
  buildActions,
  boundedSources,
  defaultDatedReminderTimes,
  fillNewReminderNotes,
} from "@/libs/ai/domain";

const user = crypto.randomUUID();
test("retrieval budgets preserve whole records rather than truncate authoritative fields", () => {
  const first = record();
  const second = record();

  const limit = Buffer.byteLength(JSON.stringify(first));
  assert.deepEqual(boundedSources([first, second], limit), [first]);
  assert.equal(first.content.notes, "Keep these instructions");
});

const record = (kind: PoxRecord["kind"] = "reminder"): PoxRecord => {
  return {
    id: crypto.randomUUID(),
    owner_id: user,
    space_id: null,
    kind,
    content: {
      ...blankContent(),
      title: "Original",
      notes: "Keep these instructions",
    },
    version: 3,
    updated_at: "",
    deleted: false,
  };
};

test("model schema converts to a strict structured output format", () => {
  const format = zodTextFormat(modelProposalSchema, "test");
  assert.equal(format.type, "json_schema");
  assert.equal(format.strict, true);
  assert.equal(format.schema.additionalProperties, false);
});
test("clarification never produces mutations and invented targets are rejected", () => {
  assert.deepEqual(
    normalizeProposal(
      { summary: "Unsure", question: "Which Peter?", actions: [] },
      [],
    ).actions,
    [],
  );
  const r = record();
  assert.throws(
    () =>
      normalizeProposal(
        {
          summary: "Update",
          question: null,
          actions: [
            {
              kind: "update",
              targetId: r.id,
              recordKind: "reminder",
              spaceId: null,
              content: r.content,
            },
          ],
        },
        [],
      ),
    /available memory/,
  );
});
test("Context instances copy the user's definition and receive fresh step identifiers", () => {
  const template = record("context");
  template.content.items = [
    {
      id: crypto.randomUUID(),
      title: "Required step",
      required: true,
      completed: true,
      assignee: null,
      instructions: "Do this carefully",
    },
  ];

  const result = normalizeProposal(
    {
      summary: "Start",
      question: null,
      actions: [
        {
          kind: "create",
          targetId: null,
          recordKind: "instance",
          spaceId: null,
          content: {
            ...blankContent(),
            title: "Execution",
            templateId: template.id,
          },
        },
      ],
    },
    [template],
  );

  const item = result.actions[0].content.items[0];
  assert.equal(item.instructions, "Do this carefully");
  assert.equal(item.required, true);
  assert.equal(item.completed, false);
  assert.notEqual(item.id, template.content.items[0].id);
});
test("AI actions preserve source fields and reject stale source or template versions", () => {
  const source = record();

  const proposal: Proposal = {
    summary: "Change title",
    question: null,
    actions: [
      {
        kind: "update",
        targetId: source.id,
        recordKind: "reminder",
        spaceId: null,
        content: { ...source.content, title: "Changed" },
      },
    ],
  };

  const result = buildActions(proposal, [source], [source], user);
  assert.equal(result[0].expectedVersion, 3);
  assert.equal(result[0].record.content.notes, source.content.notes);
  assert.throws(
    () => buildActions(proposal, [source], [{ ...source, version: 4 }], user),
    /changed/,
  );
  const template = record("context");
  proposal.actions = [
    {
      kind: "create",
      targetId: null,
      recordKind: "instance",
      spaceId: null,
      content: { ...source.content, templateId: template.id },
    },
  ];
  assert.throws(
    () =>
      buildActions(proposal, [template], [{ ...template, version: 4 }], user),
    /Context changed/,
  );
});

test("a date-only spoken reminder is scheduled for 9 AM in the user's time zone", () => {
  const proposal: Proposal = {
    summary: "Pay the Converge internet plan",
    question: null,
    actions: [
      {
        kind: "create",
        targetId: null,
        recordKind: "reminder",
        spaceId: null,
        content: {
          ...blankContent("Asia/Manila"),
          title: "Pay the Converge internet plan",
          dueDate: "2026-09-29",
        },
      },
    ],
  };

  const scheduled = defaultDatedReminderTimes(proposal, [], "Asia/Manila");
  const saved = buildActions(scheduled, [], [], user)[0].record.content;

  assert.equal(saved.dueAt, "2026-09-29T09:00:00+08:00");
  assert.equal(saved.dueDate, null);
});

test("a single recorded reminder keeps AI notes or falls back to the user's words", () => {
  const action: Proposal["actions"][number] = {
    kind: "create",
    targetId: null,
    recordKind: "reminder",
    spaceId: null,
    content: { ...blankContent(), title: "Pay internet bill" },
  };
  const proposal: Proposal = {
    summary: "Pay the bill",
    question: null,
    actions: [action],
  };
  const thought = "Pay the Converge internet plan on September twenty-nine";

  const fallback = fillNewReminderNotes(proposal, thought);
  const saved = buildActions(fallback, [], [], user)[0].record.content;

  assert.equal(saved.notes, thought);
  assert.equal(
    fillNewReminderNotes(
      {
        ...proposal,
        actions: [
          {
            ...action,
            content: {
              ...action.content,
              notes: "Settle the Converge internet plan payment.",
            },
          },
        ],
      },
      thought,
    ).actions[0].content.notes,
    "Settle the Converge internet plan payment.",
  );
});

test("notes fallback does not attach one thought to multiple reminders or overwrite updates", () => {
  const existing = record();
  const action: Proposal["actions"][number] = {
    kind: "create",
    targetId: null,
    recordKind: "reminder",
    spaceId: null,
    content: { ...blankContent(), title: "First" },
  };
  const multiple: Proposal = {
    summary: "Two reminders",
    question: null,
    actions: [
      action,
      { ...action, content: { ...action.content, title: "Second" } },
    ],
  };
  const updated: Proposal = {
    summary: "Change an existing reminder",
    question: null,
    actions: [
      {
        kind: "update",
        targetId: existing.id,
        recordKind: "reminder",
        spaceId: null,
        content: existing.content,
      },
    ],
  };

  assert.deepEqual(
    fillNewReminderNotes(multiple, "Do both").actions,
    multiple.actions,
  );
  assert.equal(
    fillNewReminderNotes(updated, "Change it").actions[0].content.notes,
    "Keep these instructions",
  );
});

test("the 9 AM default respects daylight saving time and existing scheduling choices", () => {
  const existing = record();
  existing.content.dueDate = "2026-11-01";
  const dateOnly = {
    ...blankContent("America/New_York"),
    dueDate: "2026-11-01",
  };
  const precise = {
    ...blankContent("America/New_York"),
    dueAt: "2026-11-01T14:00:00-05:00",
  };
  const proposal: Proposal = {
    summary: "Mixed scheduling",
    question: null,
    actions: [
      {
        kind: "create",
        targetId: null,
        recordKind: "instance",
        spaceId: null,
        content: dateOnly,
      },
      {
        kind: "create",
        targetId: null,
        recordKind: "reminder",
        spaceId: null,
        content: precise,
      },
      {
        kind: "create",
        targetId: null,
        recordKind: "reminder",
        spaceId: null,
        content: blankContent(),
      },
      {
        kind: "update",
        targetId: existing.id,
        recordKind: "reminder",
        spaceId: null,
        content: existing.content,
      },
      {
        kind: "create",
        targetId: null,
        recordKind: "context",
        spaceId: null,
        content: dateOnly,
      },
    ],
  };

  const actions = defaultDatedReminderTimes(
    proposal,
    [existing],
    "America/New_York",
  ).actions;

  assert.equal(actions[0].content.dueAt, "2026-11-01T09:00:00-05:00");
  assert.equal(actions[0].content.dueDate, null);
  assert.equal(actions[1].content.dueAt, precise.dueAt);
  assert.equal(actions[2].content.dueAt, null);
  assert.equal(actions[3].content.dueDate, "2026-11-01");
  assert.equal(actions[4].content.dueDate, "2026-11-01");
});
