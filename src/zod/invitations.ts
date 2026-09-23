import { z } from "zod";
import { uuid } from "@/zod/common";

export const acceptInvitationSchema = z.object({ token: uuid });
