import { schedules } from "@trigger.dev/sdk";
import { retryAccountDeletions } from "../accounts";
import {
  advanceRecurrences,
  expandOutbox,
  inspectReceipts,
  sendDueNotifications,
} from "../jobs";
export const reminders = schedules.task({
  id: "pox-reminders",
  cron: "* * * * *",
  queue: { concurrencyLimit: 1 },
  run: async () => {
    const failures: unknown[] = [];
    for (const task of [
      retryAccountDeletions,
      advanceRecurrences,
      expandOutbox,
      sendDueNotifications,
      inspectReceipts,
    ]) {
      try {
        await task();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length)
      throw new AggregateError(failures, "Background work needs retry");
  },
});
