import { z } from "zod";
import { contentSchema, itemSchema, entrySchema } from "@/zod/entries";
import { uuid, zoneSchema } from "@/zod/common";

export const proposalSchema = z.object({
  summary: z.string(),
  question: z.string().nullable(),
  actions: z
    .array(
      z.object({
        kind: z.enum(["create", "update"]),
        targetId: uuid.nullable(),
        entryKind: z.enum(["reminder", "context", "instance"]),
        spaceId: uuid.nullable(),
        completionMode: z.enum(["shared", "individual"]).optional(),
        content: contentSchema,
      }),
    )
    .max(10),
});
export type Proposal = z.infer<typeof proposalSchema>;
export const processedThoughtSchema = proposalSchema.extend({
  text: z.string(),
  entries: entrySchema.array().optional(),
});
export const interpretSchema = z.object({
  requestId: uuid,
  text: z.string().trim().min(1).max(4000),
  timeZone: zoneSchema,
  referenceTime: z.string().datetime(),
  clarification: z.string().max(4000).optional(),
  targetEntryId: uuid.optional(),
  targetSpaceId: uuid.optional(),
});

// JSON Schema cannot encode custom domain refinements. Validate those after parsing.
export const modelProposalSchema = proposalSchema.extend({
  actions: z
    .array(
      z.object({
        kind: z.enum(["create", "update"]),
        targetId: z.string().nullable(),
        entryKind: z.enum(["reminder", "context", "instance"]),
        spaceId: z.string().nullable(),
        completionMode: z.enum(["shared", "individual"]),
        content: z.object({
          ...contentSchema.shape,
          timeZone: z.string(),
          items: z
            .array(z.object({ ...itemSchema.shape, id: z.string().nullable() }))
            .max(100),
        }),
      }),
    )
    .max(10),
});
