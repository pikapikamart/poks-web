import type { z } from "zod";
import type { Mutation } from "../zod/records";
import type { prepareProposalSchema } from "../zod/ai";
import type { DatabaseClient } from "./types/client";
import { createServerClient } from "../supabase";
import { checked } from "../libs/database";
import { databaseError } from "../libs/http";

export const findProposalByRequestId = async (
  userId: string,
  requestId: string,
) =>
  checked(
    await createServerClient()
      .from("ai_proposals")
      .select("id,review_id,request_body")
      .eq("user_id", userId)
      .eq("request_id", requestId)
      .maybeSingle(),
  );

export const createProposal = async (
  db: DatabaseClient,
  input: z.infer<typeof prepareProposalSchema>,
  actions: Mutation[],
) => {
  const { data, error } = await db.rpc("prepare_proposal", {
    p_review: input.reviewId,
    p_request: input.requestId,
    p_body: input,
    p_actions: actions,
  });

  if (error) {
    databaseError(error);
  }

  return data;
};

export const applyProposalById = async (db: DatabaseClient, id: string) => {
  const { data, error } = await db.rpc("apply_proposal", { p_id: id });

  if (error) {
    databaseError(error);
  }

  return data;
};
