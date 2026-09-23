import test from "node:test";
import assert from "node:assert/strict";
import { blankContent } from "../src/libs/records";
import { defaultPreferences } from "../src/libs/preferences";
import { type PoxRecord } from "../src/zod/records";
import {
  deliverToDevices,
  receiptOutcome,
  scheduleFor,
  type Attempt,
} from "../src/libs/notifications/domain";
test("accepted devices are persisted before the next send and not resent on partial retries", async () => {
  const attempts: Attempt[] = [
      { token: "one", status: "pending" },
      { token: "two", status: "pending" },
    ],
    events: string[] = [];
  let fail = true;
  const ports = {
    eligible: async () => true,
    send: async (token: string) => {
      events.push(`send:${token}`);
      if (token === "two" && fail) throw Error("lost response");
      return { status: "ok" as const, id: `ticket:${token}` };
    },
    persist: async (token: string, outcome: { status: string }) => {
      events.push(`persist:${token}`);
      attempts.find((a) => a.token === token)!.status = outcome.status;
      return true;
    },
    retire: async () => {},
  };
  await deliverToDevices(attempts, ports);
  assert.deepEqual(events, [
    "send:one",
    "persist:one",
    "send:two",
    "persist:two",
  ]);
  fail = false;
  events.length = 0;
  await deliverToDevices(attempts, ports);
  assert.deepEqual(events, ["send:two", "persist:two"]);
});
test("revoked eligibility cancels and a lost lease stops the batch", async () => {
  let sent = 0,
    persisted = 0;
  await deliverToDevices(
    [
      { token: "one", status: "pending" },
      { token: "two", status: "pending" },
    ],
    {
      eligible: async () => false,
      send: async () => {
        sent++;
        return { status: "ok", id: "x" };
      },
      persist: async () => {
        persisted++;
        return false;
      },
      retire: async () => {},
    },
  );
  assert.equal(sent, 0);
  assert.equal(persisted, 1);
});
test("invalid tokens are retired and receipts expire instead of polling forever", async () => {
  let retired = "";
  await deliverToDevices([{ token: "bad", status: "pending" }], {
    eligible: async () => true,
    send: async () => ({
      status: "error",
      details: { error: "DeviceNotRegistered" },
    }),
    persist: async (_, r) => {
      assert.equal(r.status, "failed");
      return true;
    },
    retire: async (token) => {
      retired = token;
    },
  });
  assert.equal(retired, "bad");
  assert.equal(receiptOutcome(undefined, 0, 100), null);
  assert.equal(receiptOutcome(undefined, 0, 86_400_000), "expired");
  assert.equal(receiptOutcome({ status: "ok" }, 0, 100), "delivered");
});
test("undated and completed records stay quiet; quiet hours do not stack nudges with reminders", () => {
  const record: PoxRecord = {
    id: crypto.randomUUID(),
    owner_id: crypto.randomUUID(),
    space_id: null,
    kind: "reminder",
    version: 1,
    updated_at: "",
    deleted: false,
    content: { ...blankContent(), title: "Remember" },
  };
  assert.deepEqual(scheduleFor(record, defaultPreferences, 0), []);
  record.content.dueAt = "2026-09-23T23:00:00Z";
  const jobs = scheduleFor(
    record,
    { ...defaultPreferences, quietStart: 22, quietEnd: 7, repeatMinutes: 10 },
    Date.parse("2026-09-23T20:00:00Z"),
  );
  assert.equal(jobs[0].due_at, "2026-09-24T07:00:00.000Z");
  assert.ok(!jobs.some((j) => j.kind === "nudge"));
  assert.equal(new Set(jobs.map((j) => j.due_at)).size, jobs.length);
  record.content.completed = true;
  assert.deepEqual(scheduleFor(record, defaultPreferences, 0), []);
});
