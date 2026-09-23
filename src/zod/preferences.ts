import { z } from "zod";
import { zoneSchema } from "./common";
export const preferencesSchema = z.object({
  timeZone: zoneSchema,
  quietStart: z.number().int().min(0).max(23).nullable(),
  quietEnd: z.number().int().min(0).max(23).nullable(),
  intensity: z.enum(["subtle", "normal"]),
  snoozeMinutes: z.number().int().min(1).max(1440),
  repeatMinutes: z.number().int().min(0).max(1440),
  defaultDateHour: z.number().int().min(0).max(23).nullable(),
});
export type Preferences = z.infer<typeof preferencesSchema>;
