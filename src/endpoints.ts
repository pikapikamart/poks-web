import OpenAI from "openai";
import { z } from "zod";
import {
  interpretSchema,
  prepareProposalSchema,
  uuid,
  recordSchema,
} from "@pox/contracts";
import { authenticate, limited, env } from "./server";
import { HttpError, failure, json, audio, databaseError } from "./http";
import { interpret, prepareProposal } from "./ai";
import { finishAccountDeletion } from "./accounts";

const defaults = {
  authenticate,
  limited,
  interpret,
  prepareProposal,
  finishAccountDeletion,
  async transcribe(file: File) {
    try {
      const client = new OpenAI({
        apiKey: env("OPENAI_API_KEY"),
        timeout: 30_000,
        maxRetries: 0,
      });
      const result = await client.audio.transcriptions.create({
        file,
        model:
          process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe",
      });
      return result.text;
    } catch {
      throw new HttpError(
        502,
        "Transcription is unavailable. Try again or type your thought.",
        "AI_UNAVAILABLE",
      );
    }
  },
};
export function createEndpoints(overrides: Partial<typeof defaults> = {}) {
  const services = { ...defaults, ...overrides };
  type Session = Awaited<ReturnType<typeof authenticate>>;
  function endpoint(
    bucket: string,
    handler: (request: Request, session: Session) => Promise<unknown>,
    max = 60,
  ) {
    return async (request: Request) => {
      const requestId = crypto.randomUUID(),
        start = Date.now();
      try {
        const session = await services.authenticate(request);
        await services.limited(session.user.id, bucket, max);
        const body = await handler(request, session);
        console.info(
          JSON.stringify({
            event: "request_complete",
            requestId,
            route: bucket,
            durationMs: Date.now() - start,
          }),
        );
        return Response.json(body, {
          headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" },
        });
      } catch (error) {
        return failure(error, requestId);
      }
    };
  }
  return {
    interpret: endpoint("ai/interpret", async (req, { db, user }) =>
      services.interpret(db, user.id, interpretSchema.parse(await json(req))),
    ),
    prepare: endpoint("ai/prepare", async (req, { db, user }) => ({
      id: await services.prepareProposal(
        db,
        user.id,
        prepareProposalSchema.parse(await json(req)),
      ),
    })),
    apply: endpoint("ai/apply", async (req, { db }) => {
      const { id } = z.object({ id: uuid }).parse(await json(req));
      const { data, error } = await db.rpc("apply_proposal", { p_id: id });
      if (error) databaseError(error);
      return { records: z.array(recordSchema).parse(data) };
    }),
    transcribe: endpoint(
      "ai/transcribe",
      async (req) => ({ text: await services.transcribe(await audio(req)) }),
      30,
    ),
    accept: endpoint("invitations/accept", async (req, { db }) => {
      const { token } = z.object({ token: uuid }).parse(await json(req));
      const { data, error } = await db.rpc("accept_invite", { p_token: token });
      if (error) databaseError(error);
      return { spaceId: uuid.parse(data) };
    }),
    deleteAccount: endpoint("account/delete", async (req, { db, user }) => {
      z.object({ confirm: z.literal("DELETE") }).parse(await json(req));
      const { error } = await db.rpc("prepare_account_deletion");
      if (error) databaseError(error);
      try {
        await services.finishAccountDeletion(user.id);
        return { deleted: true };
      } catch {
        throw new HttpError(
          503,
          "Account deletion is queued and will be retried automatically.",
          "DELETION_PENDING",
        );
      }
    }),
  };
}
export const endpoints = createEndpoints();
