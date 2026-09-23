import test from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { transcriptionError } from "../src/libs/ai/transcription";
import { HttpError } from "../src/libs/http";

test("transcription errors distinguish model access, quota, rate limits and invalid audio", () => {
  for (const [status, code, expectedStatus, expectedCode] of [
    [403, "model_not_found", 503, "TRANSCRIPTION_CONFIGURATION"],
    [401, "invalid_api_key", 503, "TRANSCRIPTION_CONFIGURATION"],
    [404, "model_not_found", 503, "TRANSCRIPTION_CONFIGURATION"],
    [429, "insufficient_quota", 503, "TRANSCRIPTION_QUOTA"],
    [429, "rate_limit_exceeded", 503, "TRANSCRIPTION_BUSY"],
    [400, "invalid_value", 422, "INVALID_AUDIO"],
    [500, "server_error", 502, "AI_UNAVAILABLE"],
  ] as const) {
    const error = transcriptionError(
      new OpenAI.APIError(
        status,
        { code },
        "private provider detail",
        new Headers(),
      ),
    );
    assert.equal(error.status, expectedStatus);
    assert.equal(error.code, expectedCode);
    assert.ok(!error.message.includes("private provider detail"));
  }
});

test("transcription preserves no-speech errors and hides unexpected provider details", () => {
  const noSpeech = new HttpError(422, "No speech detected", "NO_SPEECH");
  assert.equal(transcriptionError(noSpeech), noSpeech);
  const error = transcriptionError(new Error("sensitive details"));
  assert.equal(error.code, "AI_UNAVAILABLE");
  assert.ok(!error.message.includes("sensitive details"));
});
