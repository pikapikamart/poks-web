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
  preferences: Preferences,
): string | null => {
  if (content.dueAt) {
    return content.dueAt;
  }

  if (!content.dueDate || preferences.defaultDateHour === null) {
    return null;
  }

  return DateTime.fromISO(content.dueDate, { zone: content.timeZone })
    .set({ hour: preferences.defaultDateHour })
    .toUTC()
    .toISO();
};

export const afterQuietHours = (iso: string, prefs: Preferences): string => {
  if (
    prefs.quietStart === null ||
    prefs.quietEnd === null ||
    prefs.quietStart === prefs.quietEnd
  ) {
    return iso;
  }

  let time = DateTime.fromISO(iso).setZone(prefs.timeZone);

  const h = time.hour,
    start = prefs.quietStart,
    end = prefs.quietEnd;

  const quiet = start < end ? h >= start && h < end : h >= start || h < end;

  if (!quiet) {
    return iso;
  }

  if (start > end && h >= start) {
    time = time.plus({ days: 1 });
  }

  return time
    .set({ hour: end, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toISO()!;
};
