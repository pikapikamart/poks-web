import type { Preferences } from "@/zod/preferences";

export const defaultPreferences: Preferences = {
  timeZone: "UTC",
  quietStart: null,
  quietStartMinute: 0,
  quietEnd: null,
  quietEndMinute: 0,
  intensity: "normal",
  snoozeMinutes: 10,
  repeatMinutes: 0,
  defaultDateHour: null,
};
