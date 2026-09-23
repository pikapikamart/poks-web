import { failure, HttpError } from "../../../src/http";
export async function POST() {
  return failure(new HttpError(404, "Unknown endpoint.", "NOT_FOUND"));
}
