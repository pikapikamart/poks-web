import type { Preferences } from "../zod/preferences";
export const defaultPreferences: Preferences = {
  timeZone: "UTC",
  quietStart: null,
  quietEnd: null,
  intensity: "normal",
  snoozeMinutes: 10,
  repeatMinutes: 0,
  defaultDateHour: null,
};
