import { z } from "zod";
import { contentSchema, itemSchema, recordSchema } from "./records";
import { uuid, zoneSchema } from "./common";
export const proposalSchema = z.object({
  summary: z.string(),
  question: z.string().nullable(),
  actions: z
    .array(
      z.object({
        kind: z.enum(["create", "update"]),
        targetId: uuid.nullable(),
        recordKind: z.enum(["reminder", "context", "instance"]),
        spaceId: uuid.nullable(),
        content: contentSchema,
      }),
    )
    .max(10),
});
export type Proposal = z.infer<typeof proposalSchema>;
export const reviewedProposalSchema = proposalSchema.extend({ reviewId: uuid });
export type ReviewedProposal = z.infer<typeof reviewedProposalSchema>;
export const prepareProposalSchema = reviewedProposalSchema.extend({
  requestId: uuid,
});
export const interpretSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  timeZone: zoneSchema,
  referenceTime: z.string().datetime(),
  clarification: z.string().max(4000).optional(),
});

// JSON Schema cannot encode custom domain refinements. Validate those after parsing.
export const modelProposalSchema = proposalSchema.extend({
  actions: z
    .array(
      z.object({
        kind: z.enum(["create", "update"]),
        targetId: z.string().nullable(),
        recordKind: z.enum(["reminder", "context", "instance"]),
        spaceId: z.string().nullable(),
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

export const applyProposalSchema = z.object({ id: uuid });
export const reviewSourcesSchema = z.record(z.string(), recordSchema);
