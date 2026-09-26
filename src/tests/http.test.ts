import test, { after, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { authenticate } from "@/supabase";
import {
  HttpError,
  audio,
  json,
  success,
  withApiErrorHandling,
} from "@/libs/http";
import { blankContent } from "@/libs/records";
import { POST as processThought } from "../../app/api/ai/process/route";
import { POST as prepare } from "../../app/api/ai/prepare/route";
import { POST as apply } from "../../app/api/ai/apply/route";
import { POST as accept } from "../../app/api/invitations/accept/route";
import { POST as deleteAccount } from "../../app/api/account/delete/route";
import { POST as unknownRoute } from "../../app/api/[...path]/route";
import { GET as health } from "../../app/api/health/route";

const userId = crypto.randomUUID();
const proposalId = crypto.randomUUID();
const reviewId = crypto.randomUUID();
const spaceId = crypto.randomUUID();

const environment = {
  SUPABASE_URL: "https://pox-test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable",
  SUPABASE_SECRET_KEY: "test-secret",
  OPENAI_API_KEY: "test-openai",
  OPENAI_TEXT_MODEL: "test-model",
  OPENAI_TRANSCRIPTION_MODEL: "test-transcription",
};

const original = Object.fromEntries(
  Object.keys(environment).map((key) => [key, process.env[key]]),
);

Object.assign(process.env, environment);
after(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

const input = {
  text: "Remind me tomorrow",
  timeZone: "UTC",
  referenceTime: "2026-09-23T00:00:00Z",
};

const request = (body: string, type = "application/json", authorized = true) =>
  new Request("http://localhost/api/test", {
    method: "POST",
    headers: {
      "Content-Type": type,
      ...(authorized ? { Authorization: "Bearer test-token" } : {}),
    },
    body,
  });

test("API wrapper ignores Next's optional route context", async () => {
  const handler = withApiErrorHandling("test", async (_request, context) => {
    context.stage = "workflow";

    return success({ ok: true }, context);
  });
  const response = await Reflect.apply(handler, undefined, [
    request("{}"),
    { params: Promise.resolve({}) },
  ]);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

const preparation = () => ({
  summary: "Buy milk",
  question: null,
  reviewId,
  requestId: crypto.randomUUID(),
  actions: [
    {
      kind: "create",
      targetId: null,
      recordKind: "reminder",
      spaceId: null,
      content: { ...blankContent("UTC"), title: "Buy milk" },
    },
  ],
});

type Call = { url: URL; method: string; body: unknown };

const serviceMock = (
  t: TestContext,
  override?: (call: Call) => Response | undefined,
) => {
  const calls: Call[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init);
      const body = await req.clone().text();
      let parsed: unknown = body;

      try {
        parsed = JSON.parse(body);
      } catch {}

      const call = { url: new URL(req.url), method: req.method, body: parsed };
      calls.push(call);
      const custom = override?.(call);

      if (custom) {
        return custom;
      }

      const path = call.url.pathname;

      if (path === "/auth/v1/user") {
        return Response.json({
          id: userId,
          aud: "authenticated",
          role: "authenticated",
        });
      }

      if (path === "/rest/v1/rpc/consume_api_rate") {
        const limit = (call.body as { p_limit: number }).p_limit;

        return Response.json({
          allowed: true,
          remaining: limit - 1,
          request_limit: limit,
          reset_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
      }

      if (path === "/rest/v1/ai_reviews") {
        return Response.json(
          call.method === "POST"
            ? { id: reviewId }
            : { sources: {}, expires_at: "2099-01-01T00:00:00Z" },
        );
      }

      if (path === "/rest/v1/ai_proposals") {
        return Response.json(null);
      }

      if (
        [
          "/rest/v1/reminders",
          "/rest/v1/contexts",
          "/rest/v1/spaces",
          "/rest/v1/profiles",
        ].includes(path)
      ) {
        return Response.json([]);
      }

      if (path === "/rest/v1/rpc/prepare_proposal") {
        return Response.json(proposalId);
      }

      if (path === "/rest/v1/rpc/apply_proposal") {
        return Response.json([]);
      }

      if (path === "/rest/v1/rpc/accept_invite") {
        return Response.json(spaceId);
      }

      if (
        [
          "/rest/v1/rpc/prepare_account_deletion",
          "/rest/v1/rpc/cleanup_account",
        ].includes(path)
      ) {
        return Response.json(null);
      }

      if (path === "/auth/v1/admin/users/" + userId) {
        return Response.json({ user: { id: userId } });
      }

      if (path === "/rest/v1/account_deletions") {
        return Response.json(null);
      }

      if (path === "/v1/audio/transcriptions") {
        return Response.json({ text: "Buy milk tomorrow" });
      }

      if (path === "/v1/responses") {
        return Response.json({
          id: "resp_test",
          object: "response",
          status: "completed",
          output: [
            {
              type: "message",
              id: "msg_test",
              status: "completed",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    summary: "Clarify",
                    question: "When?",
                    actions: [],
                  }),
                  annotations: [],
                },
              ],
            },
          ],
        });
      }

      throw new Error("Unexpected mocked service path: " + path);
    },
  );

  return calls;
};

test("all protected route exports reject unauthenticated requests before accessing services", async (t) => {
  const calls = serviceMock(t);

  for (const route of [processThought, prepare, apply, accept, deleteAccount]) {
    const result = await route(request("{}", "application/json", false));
    assert.equal(result.status, 401);
    const body = await result.json();
    assert.equal(body.code, "UNAUTHENTICATED");
    assert.equal(body.requestId, result.headers.get("x-request-id"));
    assert.equal(result.headers.get("cache-control"), "no-store");
  }

  assert.equal(calls.length, 0);

  for (const value of ["", "Basic secret", "Bearer a b", "Bearer "]) {
    await assert.rejects(
      authenticate(
        new Request("http://localhost", { headers: { authorization: value } }),
      ),
      (e: unknown) => e instanceof HttpError && e.status === 401,
    );
  }
});
test("all protected routes rate limit before reading input or changing data", async (t) => {
  const calls = serviceMock(t, (c) =>
    c.url.pathname.endsWith("/consume_api_rate")
      ? Response.json({
        allowed: false,
        remaining: 0,
        request_limit: (c.body as { p_limit: number }).p_limit,
        reset_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      : undefined,
  );

  for (const route of [processThought, prepare, apply, accept, deleteAccount]) {
    const result = await route(request("{}"));
    assert.equal(result.status, 429);
    assert.equal(result.headers.get("retry-after"), "3600");
  }

  assert.ok(
    calls.every(
      (c) =>
        c.url.pathname === "/auth/v1/user" ||
        c.url.pathname.endsWith("/consume_api_rate"),
    ),
  );

  const rates = calls
    .filter((c) => c.url.pathname.endsWith("/consume_api_rate"))
    .map((c) => c.body as { p_bucket: string; p_limit: number });

  assert.ok(rates.every((rate) => rate.p_limit === 60));
});
test("process route validates text, retrieves records and creates a review", async (t) => {
  const calls = serviceMock(t);
  assert.equal((await processThought(request("{"))).status, 400);
  assert.equal((await processThought(request("{}", "text/plain"))).status, 415);
  assert.equal((await processThought(request("{}"))).status, 400);
  assert.ok(!calls.some((c) => c.url.pathname === "/v1/responses"));
  const result = await processThought(request(JSON.stringify(input)));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).reviewId, reviewId);
  assert.equal(
    calls.filter((c) => c.url.pathname === "/v1/responses").length,
    1,
  );
  assert.equal(
    calls.filter(
      (c) => c.url.pathname === "/rest/v1/ai_reviews" && c.method === "POST",
    ).length,
    1,
  );
  assert.equal(
    (await unknownRoute(new Request("http://localhost/api/unknown"))).status,
    404,
  );
  assert.deepEqual(await (await health()).json(), {
    service: "pox-api",
    status: "ok",
  });
});
test("prepare route preserves reviewed actions and retries without recreating mutations", async (t) => {
  let replay = false;

  const calls = serviceMock(t, (c) =>
    c.url.pathname === "/rest/v1/ai_proposals" && replay
      ? Response.json({ id: proposalId })
      : undefined,
  );

  const value = preparation();
  let result = await prepare(request(JSON.stringify(value)));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { id: proposalId });
  let rpc = calls.find((c) => c.url.pathname.endsWith("/prepare_proposal"))!
    .body as { p_actions: unknown[]; p_request: string };
  assert.equal(rpc.p_actions.length, 1);
  assert.equal(rpc.p_request, value.requestId);
  replay = true;
  result = await prepare(request(JSON.stringify(value)));
  assert.equal(result.status, 200);
  rpc = calls
    .filter((c) => c.url.pathname.endsWith("/prepare_proposal"))
    .at(-1)!.body as typeof rpc;
  assert.deepEqual(rpc.p_actions, []);
});
test("prepare refuses expired reviews and invalid group assignments before mutation", async (t) => {
  let expired = true;

  const calls = serviceMock(t, (c) => {
    if (c.url.pathname === "/rest/v1/ai_reviews") {
      return Response.json({
        sources: {},
        expires_at: expired ? "2000-01-01T00:00:00Z" : "2099-01-01T00:00:00Z",
      });
    }

    if (c.url.pathname === "/rest/v1/space_members") {
      return Response.json([{ user_id: userId, role: "viewer" }]);
    }
  });

  const value = preparation();
  assert.equal((await prepare(request(JSON.stringify(value)))).status, 410);
  expired = false;

  const shared = {
    ...value,
    actions: value.actions.map((a) => ({ ...a, spaceId })),
  };

  assert.equal((await prepare(request(JSON.stringify(shared)))).status, 403);
  assert.ok(!calls.some((c) => c.url.pathname.endsWith("/prepare_proposal")));
});
test("apply and invitation routes validate identifiers and preserve RPC errors", async (t) => {
  let conflict = false;

  const calls = serviceMock(t, (c) =>
    conflict && c.url.pathname.endsWith("/apply_proposal")
      ? Response.json({ message: "CONFLICT", code: "P0001" }, { status: 400 })
      : undefined,
  );

  for (const route of [apply, accept]) {
    assert.equal((await route(request("{}"))).status, 400);
  }

  assert.ok(
    !calls.some((c) => /apply_proposal|accept_invite/.test(c.url.pathname)),
  );
  assert.deepEqual(
    await (await apply(request(JSON.stringify({ id: proposalId })))).json(),
    { records: [] },
  );
  assert.deepEqual(
    await (
      await accept(request(JSON.stringify({ token: crypto.randomUUID() })))
    ).json(),
    { spaceId },
  );
  conflict = true;
  assert.equal(
    (await apply(request(JSON.stringify({ id: proposalId })))).status,
    409,
  );
});
test("account deletion validates confirmation, prepares deletion, and reports retry state", async (t) => {
  let fail = false;

  const calls = serviceMock(t, (c) =>
    fail && c.url.pathname.startsWith("/auth/v1/admin/users/")
      ? Response.json({ message: "temporary failure" }, { status: 500 })
      : undefined,
  );

  assert.equal(
    (await deleteAccount(request(JSON.stringify({ confirm: "no" })))).status,
    400,
  );
  assert.ok(
    !calls.some((c) => c.url.pathname.endsWith("/prepare_account_deletion")),
  );
  assert.deepEqual(
    await (
      await deleteAccount(request(JSON.stringify({ confirm: "DELETE" })))
    ).json(),
    { deleted: true },
  );

  const mutations = calls
    .filter(
      (c) =>
        c.method !== "GET" && !c.url.pathname.endsWith("/consume_api_rate"),
    )
    .map((c) => c.url.pathname);

  assert.deepEqual(mutations, [
    "/rest/v1/rpc/prepare_account_deletion",
    "/rest/v1/rpc/cleanup_account",
    "/auth/v1/admin/users/" + userId,
  ]);
  fail = true;

  const result = await deleteAccount(
    request(JSON.stringify({ confirm: "DELETE" })),
  );

  assert.equal(result.status, 503);
  assert.equal((await result.json()).code, "DELETION_PENDING");
});
test("process route transcribes audio and returns an interpreted proposal", async (t) => {
  const calls = serviceMock(t);
  assert.ok(!calls.some((c) => c.url.pathname === "/v1/audio/transcriptions"));
  const form = new FormData();
  form.append(
    "audio",
    new File([new Uint8Array(10)], "clip.m4a", { type: "audio/mp4" }),
  );

  const result = await processThought(
    new Request(
      `http://localhost?timeZone=${encodeURIComponent(input.timeZone)}&referenceTime=${encodeURIComponent(input.referenceTime)}`,
      {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
        body: form,
      },
    ),
  );

  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.text, "Buy milk tomorrow");
  assert.equal(body.reviewId, reviewId);
  assert.equal(body.question, "When?");
  assert.equal(
    calls.filter((call) => call.url.pathname === "/v1/responses").length,
    1,
  );
});
test("provider failures return a safe response without persisting a review", async (t) => {
  const calls = serviceMock(t, (c) =>
    c.url.pathname === "/v1/responses"
      ? Response.json(
        { error: { message: "secret-provider-key" } },
        { status: 500 },
      )
      : undefined,
  );

  const result = await processThought(request(JSON.stringify(input)));
  assert.equal(result.status, 502);
  assert.ok(!(await result.text()).includes("secret-provider-key"));
  assert.ok(!calls.some((c) => c.url.pathname === "/rest/v1/ai_reviews"));
});
test("streamed JSON is bounded even without Content-Length", async () => {
  let cancelled = false;

  const stream = new ReadableStream({
    pull(c) {
      c.enqueue(new Uint8Array(60_000));
    },
    cancel() {
      cancelled = true;
    },
  });

  const req = new Request("http://localhost", {
    method: "POST",
    body: stream,
    headers: { "Content-Type": "application/json" },
    duplex: "half",
  } as RequestInit);

  await assert.rejects(
    json(req),
    (e: unknown) => e instanceof HttpError && e.status === 413,
  );
  assert.equal(cancelled, true);
});
test("audio rejects empty, unsupported and oversized recordings before transcription", async () => {
  for (const [type, size] of [
    ["audio/mp4", 0],
    ["text/plain", 10],
    ["audio/mp4", 10_000_001],
  ] as const) {
    const form = new FormData();
    form.append(
      "audio",
      new File([new Uint8Array(size)], "clip.m4a", { type }),
    );
    await assert.rejects(
      audio(new Request("http://localhost", { method: "POST", body: form })),
      HttpError,
    );
  }

  const form = new FormData();
  form.append(
    "audio",
    new File([new Uint8Array(10)], "clip.m4a", { type: "audio/mp4" }),
  );
  assert.equal(
    (
      await audio(
        new Request("http://localhost", { method: "POST", body: form }),
      )
    ).size,
    10,
  );
});
