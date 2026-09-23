import { z } from "zod";
import { uuid, zoneSchema } from "@/zod/common";

export const itemSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(200),
  required: z.boolean(),
  completed: z.boolean(),
  assignee: uuid.nullable(),
  instructions: z.string().max(4000),
});
export const contentSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    notes: z.string().max(8000),
    items: z.array(itemSchema).max(100),
    dueAt: z.string().datetime({ offset: true }).nullable(),
    dueDate: z.string().date().nullable(),
    timeZone: zoneSchema,
    priority: z.enum(["low", "normal", "high", "critical"]),
    recurrence: z.enum(["none", "daily", "weekly", "monthly", "yearly"]),
    nudgeMinutes: z.number().int().min(0).max(10080),
    completed: z.boolean(),
    archived: z.boolean(),
    templateId: uuid.nullable(),
  })
  .refine(
    (v) => !(v.dueAt && v.dueDate),
    "Choose a date or a precise time, not both",
  )
  .refine(
    (v) => v.recurrence === "none" || !!(v.dueAt || v.dueDate),
    "Recurring work needs a date",
  );
export type Content = z.infer<typeof contentSchema>;
export type Item = z.infer<typeof itemSchema>;
export const recordSchema = z.object({
  id: uuid,
  owner_id: uuid,
  space_id: uuid.nullable(),
  kind: z.enum(["reminder", "context", "instance"]),
  content: contentSchema,
  version: z.number().int().nonnegative(),
  updated_at: z.string(),
  deleted: z.boolean(),
});
export type PoxRecord = z.infer<typeof recordSchema>;
export const mutationSchema = z.object({
  operationId: uuid,
  record: recordSchema,
  expectedVersion: z.number().int().nonnegative(),
});
export type Mutation = z.infer<typeof mutationSchema>;
