import { DateTime } from "luxon";
import type { Content } from "@/zod/records";
import type { Preferences } from "@/zod/preferences";

export const nextOccurrence = (
  content: Content,
  anchor?: string | null,
): Content | null => {
  if (content.recurrence === "none") {
    return null;
  }

  const base = content.dueAt ?? content.dueDate;

  if (!base) {
    return null;
  }

  const date = DateTime.fromISO(base, { zone: content.timeZone });

  const unit = {
    daily: { days: 1 },
    weekly: { weeks: 1 },
    monthly: { months: 1 },
    yearly: { years: 1 },
  }[content.recurrence];

  let next = date.plus(unit);
  const original = DateTime.fromISO(anchor ?? base, { zone: content.timeZone });

  if (content.recurrence === "monthly" || content.recurrence === "yearly") {
    if (content.recurrence === "yearly") {
      next = next.set({ month: original.month });
    }

    next = next.set({ day: Math.min(original.day, next.daysInMonth!) });
  }

  // Preserve the original wall time after an occurrence shifts through a DST gap.
  if (content.dueAt) {
    next = next.set({
      hour: original.hour,
      minute: original.minute,
      second: original.second,
      millisecond: original.millisecond,
    });
  }

  const choices = next.getPossibleOffsets();

  if (choices.length > 1) {
    next = choices.reduce((a, b) => (a.toMillis() < b.toMillis() ? a : b));
  }

  return {
    ...content,
    dueAt: content.dueAt ? next.toUTC().toISO() : null,
    dueDate: content.dueDate ? next.toISODate() : null,
    completed: false,
    items: content.items.map((i) => ({ ...i, completed: false })),
  };
};

export const dueTime = (
  content: Content,
  _preferences: Preferences,
): string | null => {
  if (content.dueAt) {
    return content.dueAt;
  }

  return null;
};

export const afterQuietHours = (iso: string, prefs: Preferences): string => {
  if (
    prefs.quietStart === null ||
    prefs.quietEnd === null ||
    prefs.quietStart * 60 + (prefs.quietStartMinute ?? 0) ===
      prefs.quietEnd * 60 + (prefs.quietEndMinute ?? 0)
  ) {
    return iso;
  }

  let time = DateTime.fromISO(iso).setZone(prefs.timeZone);

  const current = time.hour * 60 + time.minute;
  const start = prefs.quietStart * 60 + (prefs.quietStartMinute ?? 0);
  const end = prefs.quietEnd * 60 + (prefs.quietEndMinute ?? 0);

  const quiet =
    start < end
      ? current >= start && current < end
      : current >= start || current < end;

  if (!quiet) {
    return iso;
  }

  if (start > end && current >= start) {
    time = time.plus({ days: 1 });
  }

  return time
    .set({
      hour: prefs.quietEnd,
      minute: prefs.quietEndMinute ?? 0,
      second: 0,
      millisecond: 0,
    })
    .toUTC()
    .toISO()!;
};
