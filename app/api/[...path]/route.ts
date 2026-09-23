import { HttpError, withApiErrorHandling } from "@/libs/http";

export const POST = withApiErrorHandling("unknown", async () => {
  throw new HttpError(404, "Unknown endpoint.", "NOT_FOUND");
});
