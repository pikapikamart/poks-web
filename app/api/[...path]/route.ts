import { failure, HttpError } from "../../../src/libs/http";
export const POST = async () => {
  return failure(new HttpError(404, "Unknown endpoint.", "NOT_FOUND"));
};
