import OpenAI from "openai";
import { env } from "../env";
import { HttpError } from "../http";

export const transcriptionError = (error: unknown): HttpError => {
  if (error instanceof HttpError) return error;
  if (error instanceof OpenAI.APIError) {
    if (error.code === "insufficient_quota")
      return new HttpError(
        503,
        "Voice transcription has no available API credit. You can type your thought instead.",
        "TRANSCRIPTION_QUOTA",
      );
    if (
      [401, 403, 404].includes(error.status ?? 0) ||
      error.code === "model_not_found"
    )
      return new HttpError(
        503,
        "Voice transcription is not enabled for this service yet. You can type your thought instead.",
        "TRANSCRIPTION_CONFIGURATION",
      );
    if (error.status === 429)
      return new HttpError(
        503,
        "Voice transcription is busy. Your recording is still available; try again shortly.",
        "TRANSCRIPTION_BUSY",
      );
    if (error.status === 400)
      return new HttpError(
        422,
        "This recording could not be read. Please record again or type your thought.",
        "INVALID_AUDIO",
      );
  }
  return new HttpError(
    502,
    "Transcription could not finish. Your recording is still available; try again or type your thought.",
    "AI_UNAVAILABLE",
  );
};

export const transcribe = async (file: File) => {
  const model =
    process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe";
  try {
    const client = new OpenAI({
      apiKey: env("OPENAI_API_KEY"),
      timeout: 30_000,
      maxRetries: 0,
    });
    const result = await client.audio.transcriptions.create({ file, model });
    if (!result.text?.trim())
      throw new HttpError(
        422,
        "No speech was detected. Please record again or type your thought.",
        "NO_SPEECH",
      );
    return result.text.trim();
  } catch (error) {
    // Never log audio, transcripts, keys, raw error messages, or request headers.
    console.error(
      JSON.stringify({
        event: "transcription_failed",
        model,
        providerStatus:
          error instanceof OpenAI.APIError ? error.status : undefined,
        providerCode: error instanceof OpenAI.APIError ? error.code : undefined,
        providerRequestId:
          error instanceof OpenAI.APIError ? error.requestID : undefined,
        code: transcriptionError(error).code,
      }),
    );
    throw transcriptionError(error);
  }
};
