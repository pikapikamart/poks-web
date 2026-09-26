import test from "node:test";
import assert from "node:assert/strict";
import { blankContent, completion } from "@/libs/records";
import { defaultPreferences } from "@/libs/preferences";
import { contentSchema } from "@/zod/records";
import { nextOccurrence, afterQuietHours, dueTime } from "@/libs/time";

test("daily recurrence preserves wall time across daylight saving", () => {
  const c = {
    ...blankContent("America/New_York"),
    title: "Call",
    dueAt: "2026-03-07T14:00:00.000Z",
    recurrence: "daily" as const,
  };

  assert.equal(nextOccurrence(c)?.dueAt, "2026-03-08T13:00:00.000Z");
});
test("monthly recurrence clamps a missing day", () => {
  assert.equal(
    nextOccurrence({
      ...blankContent(),
      title: "Bill",
      dueDate: "2026-01-31",
      recurrence: "monthly",
    })?.dueDate,
    "2026-02-28",
  );
});
test("monthly recurrence returns to its anchor day after February", () => {
  const january = {
    ...blankContent(),
    title: "Bill",
    dueDate: "2026-01-31",
    recurrence: "monthly" as const,
  };

  const february = nextOccurrence(january, january.dueDate)!;
  assert.equal(
    nextOccurrence(february, january.dueDate)?.dueDate,
    "2026-03-31",
  );
});
test("yearly recurrence restores leap day instead of permanently drifting", () => {
  let current = {
    ...blankContent(),
    title: "Anniversary",
    dueDate: "2024-02-29",
    recurrence: "yearly" as const,
  };

  for (let i = 0; i < 4; i++) {
    current = nextOccurrence(current, "2024-02-29")! as typeof current;
  }

  assert.equal(current.dueDate, "2028-02-29");
});
test("DST gaps shift forward and ambiguous wall times choose the earlier instant", () => {
  const content = {
    ...blankContent("America/New_York"),
    title: "Call",
    dueAt: "2026-03-07T07:30:00.000Z",
    recurrence: "daily" as const,
  };

  const gap = nextOccurrence(content, content.dueAt)!;
  assert.equal(gap.dueAt, "2026-03-08T07:30:00.000Z");
  assert.equal(
    nextOccurrence(gap, content.dueAt)?.dueAt,
    "2026-03-09T06:30:00.000Z",
  );
  assert.equal(
    nextOccurrence({ ...content, dueAt: "2026-10-31T05:30:00.000Z" })?.dueAt,
    "2026-11-01T05:30:00.000Z",
  );
});
test("undated thoughts stay quiet and optional items do not block required completion", () => {
  assert.equal(dueTime(blankContent(), defaultPreferences), null);
  assert.equal(
    completion({
      ...blankContent(),
      items: [
        {
          id: crypto.randomUUID(),
          title: "One",
          required: true,
          completed: true,
          assignee: null,
          instructions: "",
        },
        {
          id: crypto.randomUUID(),
          title: "Two",
          required: false,
          completed: false,
          assignee: null,
          instructions: "",
        },
      ],
    }),
    true,
  );
});
test("quiet hours cross midnight and date-only reminders stay quiet", () => {
  assert.equal(
    afterQuietHours("2026-09-22T23:00:00Z", {
      ...defaultPreferences,
      quietStart: 22,
      quietEnd: 7,
    }),
    "2026-09-23T07:00:00.000Z",
  );
  assert.equal(
    dueTime({ ...blankContent(), dueDate: "2026-09-22" }, defaultPreferences),
    null,
  );
  assert.equal(
    contentSchema.safeParse({
      ...blankContent(),
      title: "Repeat",
      recurrence: "daily",
    }).success,
    false,
  );
});
