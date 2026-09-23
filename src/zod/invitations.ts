import { z } from "zod";
import { uuid } from "./common";

export const acceptInvitationSchema = z.object({ token: uuid });
