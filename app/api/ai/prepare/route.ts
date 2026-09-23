import { authenticate } from "../../../../src/supabase";
import { consumeRateLimit } from "../../../../src/database/rate-limits";
import { failure, success, json, HttpError } from "../../../../src/libs/http";
import { prepareProposalSchema } from "../../../../src/zod/ai";
import { recordSchema } from "../../../../src/zod/records";
import { reviewSourcesSchema } from "../../../../src/zod/ai";
import {
  createProposal,
  findProposalByRequestId,
} from "../../../../src/database/proposals";
import { findReviewById } from "../../../../src/database/reviews";
import { findRecordsByIds } from "../../../../src/database/records";
import { listMembersBySpaceId } from "../../../../src/database/members";
import { buildActions } from "../../../../src/libs/ai/domain";
export const runtime = "nodejs";
export const POST = async (request: Request) => {
  const requestId = crypto.randomUUID(),
    start = Date.now();
  try {
    const { db, user } = await authenticate(request);
    await consumeRateLimit(user.id, "ai/prepare", 60);
    const input = prepareProposalSchema.parse(await json(request));
    if (input.question || !input.actions.length)
      throw new HttpError(
        400,
        "Resolve the clarification first.",
        "CLARIFICATION_REQUIRED",
      );
    const existing = await findProposalByRequestId(user.id, input.requestId);
    // The RPC compares JSONB and safely replays concurrent preparation requests.
    if (existing) {
      const id = await createProposal(db, input, []);
      return success({ id }, requestId, "ai/prepare", start);
    }
    const review = await findReviewById(user.id, input.reviewId);
    if (!review || new Date(review.expires_at).getTime() <= Date.now())
      throw new HttpError(
        410,
        "Review this thought again before saving.",
        "PROPOSAL_EXPIRED",
      );
    const sources = reviewSourcesSchema.parse(review.sources);
    const ids = [
      ...new Set(
        input.actions.flatMap((a) =>
          [a.targetId, a.content.templateId].filter((id): id is string => !!id),
        ),
      ),
    ];
    const current = (await findRecordsByIds(db, ids)).map((r) =>
      recordSchema.parse(r),
    );
    const actions = buildActions(
      input,
      Object.values(sources),
      current,
      user.id,
    );
    for (const action of actions) {
      const r = action.record;
      if (r.space_id) {
        const members = await listMembersBySpaceId(db, r.space_id);
        if (
          !members.some(
            (m) =>
              m.user_id === user.id && ["owner", "editor"].includes(m.role),
          )
        )
          throw new HttpError(403, "You cannot edit this group.", "FORBIDDEN");
        if (
          r.content.items.some(
            (i) => i.assignee && !members.some((m) => m.user_id === i.assignee),
          )
        )
          throw new HttpError(
            400,
            "Choose a current group member for each assignment.",
            "INVALID_ASSIGNEE",
          );
      } else if (
        r.content.items.some((i) => i.assignee && i.assignee !== user.id)
      )
        throw new HttpError(
          400,
          "Personal memories can only be assigned to you.",
          "INVALID_ASSIGNEE",
        );
    }

    const id = await createProposal(db, input, actions);
    return success({ id }, requestId, "ai/prepare", start);
  } catch (error) {
    return failure(error, requestId);
  }
};
