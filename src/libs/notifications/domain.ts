import { DateTime } from "luxon";
import type { PoxRecord } from "@/zod/records";
import type { Preferences } from "@/zod/preferences";
import { afterQuietHours, dueTime } from "@/libs/time";

export const scheduleFor = (
  record: PoxRecord,
  prefs: Preferences,
  now: number,
) => {
  if (
    record.deleted ||
    record.kind === "context" ||
    record.content.completed ||
    record.content.archived
  ) {
    return [];
  }

  const due = dueTime(record.content, prefs);

  if (!due) {
    return [];
  }

  const main = afterQuietHours(due, prefs);
  const jobs = [{ kind: "due", due_at: main }];

  const used = new Set([Date.parse(main)]);

  const nudge = DateTime.fromISO(due)
    .minus({ minutes: record.content.nudgeMinutes })
    .toISO()!;

  const allowed = afterQuietHours(nudge, prefs);

  if (
    record.content.nudgeMinutes > 0 &&
    Date.parse(allowed) > now &&
    Date.parse(allowed) < Date.parse(due)
  ) {
    jobs.push({ kind: "nudge", due_at: allowed });
    used.add(Date.parse(allowed));
  }

  return jobs;
};

export type PushTicket = {
  status: "ok" | "error";
  id?: string;
  details?: { error?: string };
};
export type Attempt = { token: string; status: string };
type Outcome = {
  status: "pending" | "accepted" | "failed" | "cancelled";
  ticket: string | null;
  error: string | null;
};

export const deliverToDevices = async (
  attempts: Attempt[],
  ports: {
    eligible: (token: string) => Promise<boolean>;
    send: (token: string) => Promise<PushTicket>;
    persist: (token: string, outcome: Outcome) => Promise<boolean>;
    retire: (token: string) => Promise<void>;
  },
) => {
  for (const attempt of attempts) {
    if (attempt.status !== "pending") {
      continue;
    }

    if (!(await ports.eligible(attempt.token))) {
      if (
        !(await ports.persist(attempt.token, {
          status: "cancelled",
          ticket: null,
          error: "NO_LONGER_ELIGIBLE",
        }))
      ) {
        return;
      }

      continue;
    }

    let outcome: Outcome;
    let invalid = false;

    try {
      const ticket = await ports.send(attempt.token);
      invalid = ticket.details?.error === "DeviceNotRegistered";
      outcome =
        ticket.status === "ok" && ticket.id
          ? { status: "accepted", ticket: ticket.id, error: null }
          : {
            status:
                invalid ||
                ticket.details?.error === "MessageTooBig" ||
                ticket.details?.error === "InvalidCredentials"
                  ? "failed"
                  : "pending",
            ticket: null,
            error: ticket.details?.error ?? "PUSH_REJECTED",
          };
    } catch {
      outcome = { status: "pending", ticket: null, error: "PUSH_UNCONFIRMED" };
    }

    // Persist each accepted ticket before attempting the next device.
    if (!(await ports.persist(attempt.token, outcome))) {
      return;
    }

    if (invalid) {
      await ports.retire(attempt.token);
    }
  }
};

export const receiptOutcome = (
  receipt: PushTicket | undefined,
  acceptedAt: number,
  now: number,
) => {
  if (!receipt) {
    return now - acceptedAt >= 24 * 60 * 60_000 ? "expired" : null;
  }

  return receipt.status === "ok"
    ? "delivered"
    : (receipt.details?.error ?? "error");
};
