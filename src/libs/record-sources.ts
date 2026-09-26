import type { DatabaseClient } from "@/database/types/client";
import {
  findContextsByIds,
  findContextsBySearchTerms,
  listContexts,
} from "@/database/contexts";
import {
  findRemindersByIds,
  findRemindersBySearchTerms,
  listRecentReminders,
} from "@/database/reminders";

const normalizeReminder = (
  record: Awaited<ReturnType<typeof listRecentReminders>>[number],
) => ({
  ...record,
  space_id: record.space_reminders?.space_id ?? null,
  content: {
    ...(record.content as Record<string, unknown>),
    templateId: record.context_reminders?.context_id ?? null,
  },
  context_reminders: undefined,
  space_reminders: undefined,
});

export const findRecordsBySearchTerms = async (
  db: DatabaseClient,
  terms: string,
) => {
  const [reminders, contexts] = await Promise.all([
    findRemindersBySearchTerms(db, terms),
    findContextsBySearchTerms(db, terms),
  ]);

  return [...reminders.map(normalizeReminder), ...contexts];
};

export const listContextRecords = async (db: DatabaseClient) => {
  return listContexts(db);
};

export const listRecentRecords = async (db: DatabaseClient) => {
  const [reminders, contexts] = await Promise.all([
    listRecentReminders(db),
    listContexts(db),
  ]);

  return [...reminders.map(normalizeReminder), ...contexts]
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, 30);
};

export const findRecordsByIds = async (db: DatabaseClient, ids: string[]) => {
  const [reminders, contexts] = await Promise.all([
    findRemindersByIds(db, ids),
    findContextsByIds(db, ids),
  ]);

  return [...reminders.map(normalizeReminder), ...contexts];
};
