import { z } from "zod";
export const ticketSchema = z.object({
  status: z.enum(["ok", "error"]),
  id: z.string().optional(),
  details: z.object({ error: z.string().optional() }).optional(),
});

export const pushTicketResponseSchema = z.object({ data: ticketSchema });
export const pushReceiptsResponseSchema = z.object({
  data: z.record(z.string(), ticketSchema),
});
