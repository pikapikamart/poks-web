import { z } from "zod";

export const deleteAccountSchema = z.object({ confirm: z.literal("DELETE") });
