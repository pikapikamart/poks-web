import { createServerClient } from "@/supabase";
import type { ApiRateLimitPolicy } from "@/libs/api/rate-limit";

export const consumeRateLimit = async (
  subject: string,
  bucket: string,
  policy: ApiRateLimitPolicy,
) => {
  const { data, error } = await createServerClient().rpc("consume_api_rate", {
    p_subject: subject,
    p_bucket: bucket,
    p_limit: policy.limit,
    p_window_seconds: policy.windowSeconds,
  });

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
    throw new Error("Rate limit did not return a result.");
  }

  return result;
};
