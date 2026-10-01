import type { DatabaseClient } from "@/database/types/client";
import { createServerClient } from "@/supabase";
import { checked } from "@/libs/database";
import { databaseError } from "@/libs/http";
import type { Proposal } from "@/zod/ai";
import type { Mutation, PoxEntry } from "@/zod/entries";

export const findAiOperationByRequestId = async (
  userId: string,
  requestId: string,
) => {
  const db = createServerClient();

  return checked(
    await db
      .from("ai_operations")
      .select("request_body,proposal,result,status")
      .eq("user_id", userId)
      .eq("request_id", requestId)
      .maybeSingle(),
  );
};

export const applyAiOperation = async (
  db: DatabaseClient,
  requestId: string,
  requestBody: unknown,
  proposal: Proposal,
  sources: PoxEntry[],
  actions: Mutation[],
) => {
  const { data, error } = await db.rpc("apply_ai_operation", {
    p_request: requestId,
    p_request_body: requestBody as never,
    p_proposal: proposal,
    p_sources: Object.fromEntries(sources.map((source) => [source.id, source])),
    p_actions: actions,
  });

  if (error) {
    databaseError(error);
  }

  return data;
};
