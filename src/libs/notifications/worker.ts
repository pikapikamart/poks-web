import {
  pushTicketResponseSchema,
  pushReceiptsResponseSchema,
} from "@/zod/notifications";
import { createServerClient } from "@/supabase";
import { defaultPreferences } from "@/libs/preferences";
import { preferencesSchema } from "@/zod/preferences";
import { entrySchema, type PoxEntry } from "@/zod/entries";
import { afterQuietHours, dueTime, nextOccurrence } from "@/libs/time";
import type { Delivery, DeliveryUpdate } from "@/database/types/notifications";
import { expoRequest } from "@/libs/notifications/expo";
import {
  deliverToDevices,
  receiptOutcome,
  scheduleFor,
} from "@/libs/notifications/domain";

const checked = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) {
    throw error;
  }

  return data;
};

const recipients = async (entry: PoxEntry) => {
  const users = entry.space_id
    ? (
      checked(
        await createServerClient()
          .from("space_members")
          .select("user_id")
          .eq("space_id", entry.space_id),
      ) ?? []
    ).map((r) => r.user_id)
    : [entry.owner_id];

  const deleting = checked(
    await createServerClient()
      .from("account_deletions")
      .select("user_id")
      .in("user_id", users),
  );

  return users.filter(
    (id): id is string => !!id && !deleting?.some((d) => d.user_id === id),
  );
};

const preferences = async (user: string) => {
  const row = checked(
    await createServerClient()
      .from("profiles")
      .select("preferences")
      .eq("id", user)
      .maybeSingle(),
  );

  return row ? preferencesSchema.parse(row.preferences) : defaultPreferences;
};

const generation = async (user: string) => {
  return (
    checked(
      await createServerClient()
        .from("notification_epochs")
        .select("generation")
        .eq("user_id", user)
        .maybeSingle(),
    )?.generation ?? 0
  );
};

export const expandOutbox = async () => {
  const db = createServerClient();

  const events = checked(
    await db
      .from("reminder_outbox")
      .select("*")
      .eq("processed", false)
      .lte("retry_at", new Date().toISOString())
      .order("id")
      .limit(100),
  );

  for (const event of events ?? []) {
    try {
      const raw = checked(
        await db
          .from("reminders")
          .select("*")
          .eq("id", event.reminder_id)
          .maybeSingle(),
      );

      if (raw) {
        const entry = entrySchema.parse(raw);

        if (entry.version === event.revision) {
          checked(
            await db
              .from("notification_deliveries")
              .update({ status: "cancelled", claim_token: null })
              .eq("reminder_id", entry.id)
              .neq("revision", entry.version)
              .in("status", ["pending", "sending"]),
          );

          for (const user of await recipients(entry)) {
            const prefs = await preferences(user);
            const epoch = await generation(user);

            const sent =
              checked(
                await db
                  .from("notification_deliveries")
                  .select("kind")
                  .eq("reminder_id", entry.id)
                  .eq("revision", entry.version)
                  .eq("user_id", user)
                  .eq("status", "sent"),
              ) ?? [];

            for (const job of scheduleFor(entry, prefs, Date.now())) {
              if (sent.some((s) => s.kind === job.kind)) {
                continue;
              }

              checked(
                await db.from("notification_deliveries").upsert(
                  {
                    ...job,
                    reminder_id: entry.id,
                    revision: entry.version,
                    user_id: user,
                    generation: epoch,
                  },
                  {
                    onConflict: "reminder_id,revision,user_id,kind,generation",
                    ignoreDuplicates: true,
                  },
                ),
              );
            }
          }
        }
      }

      checked(
        await db
          .from("reminder_outbox")
          .update({ processed: true })
          .eq("id", event.id)
          .eq("generation", event.generation),
      );
    } catch {
      console.error(JSON.stringify({ event: "outbox_failed", id: event.id }));
      checked(
        await db
          .from("reminder_outbox")
          .update({
            failures: event.failures + 1,
            processed: event.failures >= 4,
            last_error: "EXPANSION_FAILED",
            retry_at: new Date(
              Date.now() + 60_000 * (event.failures + 1),
            ).toISOString(),
          })
          .eq("id", event.id)
          .eq("generation", event.generation),
      );
    }
  }
};

export const advanceRecurrences = async () => {
  const db = createServerClient();
  const rows = checked(await db.rpc("due_recurrences"));

  for (const raw of rows ?? []) {
    try {
      const entry = entrySchema.parse(raw);
      const next = nextOccurrence(entry.content, raw.recurrence_anchor);

      if (next) {
        const users = await recipients(entry);
        next.items = next.items.map((i) => ({
          ...i,
          assignee:
            i.assignee && users.includes(i.assignee) ? i.assignee : null,
        }));
        checked(
          await db.rpc("spawn_occurrence", {
            p_parent: entry.id,
            p_revision: entry.version,
            p_content: next,
          }),
        );
      }
    } catch {
      console.error(
        JSON.stringify({ event: "recurrence_failed", recordId: raw.id }),
      );
    }
  }
};

const eligibleRecord = async (job: Delivery) => {
  if (!job.reminder_id) {
    const deleting = checked(
      await createServerClient()
        .from("account_deletions")
        .select("user_id")
        .eq("user_id", job.user_id)
        .maybeSingle(),
    );

    return !deleting && (await generation(job.user_id)) === job.generation
      ? undefined
      : null;
  }

  const raw = checked(
    await createServerClient()
      .from("reminders")
      .select("*")
      .eq("id", job.reminder_id)
      .maybeSingle(),
  );

  const entry = raw ? entrySchema.parse(raw) : null;

  if (
    !entry ||
    entry.version !== job.revision ||
    entry.deleted ||
    entry.content.archived ||
    (!job.kind.startsWith("activity:") && entry.content.completed) ||
    !(await recipients(entry).then((users) => users.includes(job.user_id))) ||
    (await generation(job.user_id)) !== job.generation
  ) {
    return null;
  }

  return entry;
};

const finish = async (job: Delivery, values: DeliveryUpdate) => {
  if (!job.claim_token) {
    return;
  }

  checked(
    await createServerClient()
      .from("notification_deliveries")
      .update(values)
      .eq("id", job.id)
      .eq("claim_token", job.claim_token)
      .eq("status", "sending")
      .gt("lease_until", new Date().toISOString()),
  );
};

export const sendDueNotifications = async () => {
  const db = createServerClient();
  const jobs = checked(await db.rpc("claim_deliveries", { p_limit: 10 }));

  for (const job of jobs ?? []) {
    try {
      const entry = await eligibleRecord(job);

      if (entry === null) {
        await finish(job, { status: "cancelled" });
        continue;
      }

      const prefs = await preferences(job.user_id);
      const now = Date.now();
      const allowed = afterQuietHours(new Date(now).toISOString(), prefs);

      if (new Date(allowed).getTime() > now + 1000) {
        await finish(job, {
          status: "pending",
          due_at: allowed,
          attempts: Math.max(0, job.attempts - 1),
        });
        continue;
      }

      if (
        entry &&
        job.kind === "nudge" &&
        Date.parse(dueTime(entry.content, prefs) ?? "1970-01-01") <= now
      ) {
        await finish(job, { status: "cancelled" });
        continue;
      }

      const body =
        job.body ??
        (entry
          ? job.kind === "nudge"
            ? `Coming up: ${entry.content.title}`
            : job.kind === "missed"
              ? `Reminder not completed: ${entry.content.title}`
              : entry.content.title
          : "A Space you shared has changed.");

      if (entry && job.kind === "missed") {
        checked(
          await db.from("notification_inbox").upsert(
            {
              user_id: job.user_id,
              reminder_id: entry.id,
              body,
              event_key: `missed:${entry.id}:${job.revision}:${job.user_id}`,
            },
            { onConflict: "event_key", ignoreDuplicates: true },
          ),
        );
      }

      const devices =
        checked(
          await db
            .from("notification_devices")
            .select("token")
            .eq("user_id", job.user_id),
        ) ?? [];

      if (devices.length) {
        checked(
          await db.from("notification_device_deliveries").upsert(
            devices.map((d) => ({ delivery_id: job.id, token: d.token })),
            { onConflict: "delivery_id,token", ignoreDuplicates: true },
          ),
        );
      }

      const previous = entry
        ? (checked(
          await db
            .from("notification_deliveries")
            .select("id")
            .eq("reminder_id", entry.id)
            .eq("revision", job.revision)
            .eq("user_id", job.user_id)
            .eq("kind", job.kind)
            .neq("id", job.id),
        ) ?? [])
        : [];

      if (previous.length) {
        const accepted =
          checked(
            await db
              .from("notification_device_deliveries")
              .select("token")
              .in(
                "delivery_id",
                previous.map((p) => p.id),
              )
              .eq("status", "accepted"),
          ) ?? [];

        if (accepted.length) {
          checked(
            await db
              .from("notification_device_deliveries")
              .update({ status: "cancelled", last_error: "ALREADY_ACCEPTED" })
              .eq("delivery_id", job.id)
              .eq("status", "pending")
              .in(
                "token",
                accepted.map((a) => a.token),
              ),
          );
        }
      }

      const attempts =
        checked(
          await db
            .from("notification_device_deliveries")
            .select("token,status")
            .eq("delivery_id", job.id),
        ) ?? [];

      await deliverToDevices(attempts, {
        eligible: async (token) => {
          const lease = checked(
            await db
              .from("notification_deliveries")
              .select("id")
              .eq("id", job.id)
              .eq("claim_token", job.claim_token!)
              .eq("status", "sending")
              .gt("lease_until", new Date().toISOString())
              .maybeSingle(),
          );

          if (!lease || (await eligibleRecord(job)) === null) {
            return false;
          }

          const device = checked(
            await db
              .from("notification_devices")
              .select("token")
              .eq("token", token)
              .eq("user_id", job.user_id)
              .maybeSingle(),
          );

          return !!device;
        },
        send: async (token) => {
          const value = await expoRequest("send", {
            to: token,
            title: job.kind.startsWith("space-removal:")
              ? "Space update"
              : job.kind === "nudge"
                ? "A little nudge"
                : job.kind === "missed"
                  ? "Reminder not completed"
                  : "Pox remembers",
            body,
            data: {
              recordId: entry?.id,
              eventId: job.id,
              revision: job.revision,
              kind: job.kind,
            },
            ...(entry && job.kind === "due" ? { categoryId: "memory" } : {}),
            channelId: job.kind === "nudge" ? "gentle-v3" : "reminders-v3",
            sound: "default",
            priority: job.kind === "nudge" ? "normal" : "high",
            ...(entry && ["due", "missed"].includes(job.kind)
              ? {
                collapseId: `reminder-${entry.id}`,
                tag: `reminder-${entry.id}`,
              }
              : {}),
            ...(job.kind === "due" ? { ttl: 180 } : {}),
          });

          return pushTicketResponseSchema.parse(value).data;
        },
        persist: async (token, result) => {
          return (
            checked(
              await db.rpc("finish_device_attempt", {
                p_job: job.id,
                p_claim: job.claim_token!,
                p_token: token,
                p_status: result.status,
                ...(result.ticket ? { p_ticket: result.ticket } : {}),
                ...(result.error ? { p_error: result.error } : {}),
              }),
            ) === true
          );
        },
        retire: async (token) => {
          checked(
            await db
              .from("notification_devices")
              .delete()
              .eq("token", token)
              .eq("user_id", job.user_id),
          );
        },
      });

      const results =
        checked(
          await db
            .from("notification_device_deliveries")
            .select("status")
            .eq("delivery_id", job.id),
        ) ?? [];

      const pending = results.some((r) => r.status === "pending");
      const failed = results.some((r) => r.status === "failed");

      await finish(job, {
        status: pending
          ? job.attempts >= 5
            ? "failed"
            : "pending"
          : failed
            ? "failed"
            : "sent",
        due_at: new Date(Date.now() + 60_000 * job.attempts).toISOString(),
        last_error: pending
          ? "PUSH_UNCONFIRMED"
          : failed
            ? "PUSH_REJECTED"
            : null,
      });
    } catch {
      console.error(
        JSON.stringify({ event: "delivery_failed", deliveryId: job.id }),
      );
      await finish(job, {
        status: job.attempts >= 5 ? "failed" : "pending",
        last_error: "DELIVERY_FAILED",
        due_at: new Date(Date.now() + 60_000 * job.attempts).toISOString(),
      });
    }
  }
};

export const inspectReceipts = async () => {
  const db = createServerClient();
  const rows = checked(
    await db
      .from("notification_device_deliveries")
      .select("*")
      .eq("status", "accepted")
      .is("receipt_status", null)
      .lte("accepted_at", new Date(Date.now() - 15 * 60_000).toISOString())
      .order("accepted_at")
      .limit(100),
  );

  if (!rows?.length) {
    return;
  }

  const result = pushReceiptsResponseSchema.parse(
    await expoRequest("getReceipts", { ids: rows.map((r) => r.ticket_id) }),
  );

  for (const row of rows) {
    const outcome = receiptOutcome(
      result.data[row.ticket_id!],
      Date.parse(row.accepted_at!),
      Date.now(),
    );

    if (outcome === null) {
      continue;
    }

    checked(
      await db.rpc("record_push_receipt", {
        p_job: row.delivery_id,
        p_token: row.token,
        p_ticket: row.ticket_id!,
        p_outcome: outcome,
      }),
    );
  }
};
