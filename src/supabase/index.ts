import { HttpError } from "../libs/http";
import { createAuthenticatedClient } from "./client";

export { createAuthenticatedClient } from "./client";
export { createServerClient } from "./server";

export const authenticate = async (request: Request) => {
  const accessToken = request.headers
    .get("authorization")
    ?.match(/^Bearer ([^\s]+)$/i)?.[1];

  if (!accessToken) {
    throw new HttpError(401, "Sign in to continue.", "UNAUTHENTICATED");
  }

  const db = createAuthenticatedClient(accessToken);
  const { data, error } = await db.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new HttpError(
      401,
      "Your session expired. Please sign in again.",
      "UNAUTHENTICATED",
    );
  }

  return { db, user: data.user };
};
