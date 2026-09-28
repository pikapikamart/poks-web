import { z } from "zod";
import { zoneSchema } from "@/zod/common";

export const preferencesSchema = z.object({
  timeZone: zoneSchema,
  quietStart: z.number().int().min(0).max(23).nullable(),
  quietStartMinute: z.number().int().min(0).max(59).optional(),
  quietEnd: z.number().int().min(0).max(23).nullable(),
  quietEndMinute: z.number().int().min(0).max(59).optional(),
  intensity: z.enum(["subtle", "normal"]),
  repeatMinutes: z.number().int().min(0).max(1440),
  defaultDateHour: z.number().int().min(0).max(23).nullable(),
});
export type Preferences = z.infer<typeof preferencesSchema>;
