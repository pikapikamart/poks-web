import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@supabase/supabase-js";
import { createEndpoints } from "../src/endpoints";
import { authenticate } from "../src/server";
import { HttpError, audio, json } from "../src/http";
import { POST as unknownRoute } from "../app/api/[...path]/route";
const request = (body: string, type = "application/json") =>
  new Request("http://localhost/api/ai/interpret", {
    method: "POST",
    headers: { "Content-Type": type },
    body,
  });
const input = {
  text: "Remind me tomorrow",
  timeZone: "UTC",
  referenceTime: "2026-09-23T00:00:00Z",
};
const session = {
  db: {} as Awaited<ReturnType<typeof authenticate>>["db"],
  user: { id: crypto.randomUUID() } as User,
};
test("malformed bearer headers fail before configuration or database access", async () => {
  for (const value of ["", "Basic secret", "Bearer a b", "Bearer "])
    await assert.rejects(
      authenticate(
        new Request("http://localhost", { headers: { authorization: value } }),
      ),
      (e: unknown) => e instanceof HttpError && e.status === 401,
    );
});
test("HTTP authentication and rate limits run before provider work", async () => {
  let calls = 0;
  const unauth = createEndpoints({
    authenticate: async () => {
      throw new HttpError(401, "Sign in", "UNAUTHENTICATED");
    },
    interpret: async () => {
      calls++;
      throw Error();
    },
  });
  const result = await unauth.interpret(request(JSON.stringify(input)));
  assert.equal(result.status, 401);
  assert.equal(calls, 0);
  const body = await result.json();
  assert.equal(body.requestId, result.headers.get("x-request-id"));
  assert.equal(body.code, "UNAUTHENTICATED");
  const limited = createEndpoints({
    authenticate: async () => session,
    limited: async () => {
      throw new HttpError(429, "Slow down", "RATE_LIMITED");
    },
    interpret: async () => {
      calls++;
      throw Error();
    },
  });
  assert.equal(
    (await limited.interpret(request(JSON.stringify(input)))).status,
    429,
  );
  assert.equal(calls, 0);
});
test("route boundaries validate JSON and preserve a stable success contract", async () => {
  let calls = 0;
  const endpoints = createEndpoints({
    authenticate: async () => session,
    limited: async () => {},
    interpret: async () => {
      calls++;
      return {
        summary: "Clarify",
        question: "When?",
        actions: [],
        reviewId: crypto.randomUUID(),
      };
    },
  });
  assert.equal((await endpoints.interpret(request("{"))).status, 400);
  assert.equal(
    (await endpoints.interpret(request("{}", "text/plain"))).status,
    415,
  );
  assert.equal((await endpoints.interpret(request("{}"))).status, 400);
  const result = await endpoints.interpret(request(JSON.stringify(input)));
  assert.equal(result.status, 200);
  assert.equal(calls, 1);
  assert.ok((await result.json()).reviewId);
  assert.equal((await unknownRoute()).status, 404);
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
test("provider failure returns a safe error and does not disclose exception contents", async () => {
  const endpoints = createEndpoints({
    authenticate: async () => session,
    limited: async () => {},
    interpret: async () => {
      throw Error("secret-provider-key");
    },
  });
  const result = await endpoints.interpret(request(JSON.stringify(input)));
  assert.equal(result.status, 500);
  assert.ok(!(await result.text()).includes("secret-provider-key"));
});
