import { schedules } from "@trigger.dev/sdk";
import { retryPendingAccountDeletions } from "@/libs/account-deletions";
import {
  advanceRecurrences,
  expandOutbox,
  inspectReceipts,
  sendDueNotifications,
} from "@/libs/notifications/worker";

export const reminders = schedules.task({
  id: "pox-reminders",
  cron: "* * * * *",
  queue: { concurrencyLimit: 1 },
  run: async () => {
    const failures: unknown[] = [];

    for (const task of [
      retryPendingAccountDeletions,
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

    if (failures.length) {
      throw new AggregateError(failures, "Background work needs retry");
    }
  },
});
