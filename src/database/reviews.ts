import { createServerClient } from "@/supabase";
import type { PoxRecord } from "@/zod/records";
import { checked } from "@/libs/database";

export const createReview = async (userId: string, records: PoxRecord[]) => {
  const review = checked(
    await createServerClient()
      .from("ai_reviews")
      .insert({
        user_id: userId,
        sources: Object.fromEntries(
          records.map((record) => [record.id, record]),
        ),
      })
      .select("id")
      .single(),
  );

  if (!review) {
    throw new Error("Review creation returned no data");
  }

  return review.id;
};

export const findReviewById = async (userId: string, reviewId: string) =>
  checked(
    await createServerClient()
      .from("ai_reviews")
      .select("sources,expires_at")
      .eq("id", reviewId)
      .eq("user_id", userId)
      .maybeSingle(),
  );
