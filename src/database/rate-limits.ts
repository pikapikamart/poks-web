import { createServerClient } from "../supabase";
import { HttpError } from "../libs/http";

export const consumeRateLimit = async (
  userId: string,
  bucket: string,
  max = 60,
) => {
  const { data, error } = await createServerClient().rpc("consume_rate", {
    p_user: userId,
    p_bucket: bucket,
    p_max: max,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(
      429,
      "Please take a moment before trying again.",
      "RATE_LIMITED",
    );
  }
};
