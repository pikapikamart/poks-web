import { modelProposalSchema } from "../src/zod/ai";
import test from "node:test";
import assert from "node:assert/strict";
import { zodTextFormat } from "openai/helpers/zod";
import { blankContent } from "../src/libs/records";
import { type PoxRecord } from "../src/zod/records";
import { type Proposal } from "../src/zod/ai";
import {
  normalizeProposal,
  buildActions,
  boundedSources,
} from "../src/libs/ai/domain";
const user = crypto.randomUUID();
test("retrieval budgets preserve whole records rather than truncate authoritative fields", () => {
  const first = record(),
    second = record();
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
test("prepared actions preserve reviewed fields and reject stale source or template versions", () => {
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
