import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}
export function databaseError(error: { message: string }): never {
  const message = error.message;
  if (/CONFLICT/.test(message))
    throw new HttpError(
      409,
      "This changed while you were reviewing it. Refresh and review again.",
      "CONFLICT",
    );
  if (/TRANSFER_OWNERSHIP/.test(message))
    throw new HttpError(
      409,
      "Transfer ownership or delete your shared spaces first.",
      "OWNED_SPACES",
    );
  if (/UNAUTHENTICATED|ACCOUNT_DELETING/.test(message))
    throw new HttpError(
      403,
      "This account is unavailable.",
      "ACCOUNT_UNAVAILABLE",
    );
  if (/FORBIDDEN/.test(message))
    throw new HttpError(
      403,
      "You do not have permission for this change.",
      "FORBIDDEN",
    );
  if (/EXPIRED|UNAVAILABLE/.test(message))
    throw new HttpError(
      410,
      "This invitation or proposal is no longer available.",
      "EXPIRED",
    );
  if (/INVALID|DUPLICATE|CANNOT/.test(message))
    throw new HttpError(
      400,
      "Check the details of your request.",
      "INVALID_REQUEST",
    );
  throw error;
}
export function failure(error: unknown, requestId = crypto.randomUUID()) {
  const mapped =
    error instanceof ZodError
      ? new HttpError(400, "Invalid request.", "INVALID_REQUEST")
      : error instanceof HttpError
        ? error
        : new HttpError(
            500,
            "This request could not be completed. Please try again.",
            "INTERNAL_ERROR",
          );
  console.error(
    JSON.stringify({
      event: "request_failed",
      requestId,
      status: mapped.status,
      code: mapped.code,
    }),
  );
  return Response.json(
    { error: mapped.message, code: mapped.code, requestId },
    {
      status: mapped.status,
      headers: {
        "X-Request-Id": requestId,
        "Cache-Control": "no-store",
        ...(mapped.status === 429 ? { "Retry-After": "3600" } : {}),
      },
    },
  );
}
export async function boundedBody(
  request: Request,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit))
    throw new HttpError(413, "Request too large.", "BODY_TOO_LARGE");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, "Request too large.", "BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function json(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new HttpError(
      415,
      "Send JSON for this request.",
      "UNSUPPORTED_MEDIA",
    );
  const bytes = await boundedBody(request, 100_000);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, "Malformed JSON.", "INVALID_JSON");
  }
}
export async function audio(request: Request): Promise<File> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(type))
    throw new HttpError(
      415,
      "Send a multipart recording.",
      "UNSUPPORTED_MEDIA",
    );
  const bytes = await boundedBody(request, 10_065_536);
  let form: FormData;
  try {
    form = await new Response(bytes, {
      headers: { "content-type": type },
    }).formData();
  } catch {
    throw new HttpError(400, "Malformed recording upload.", "INVALID_AUDIO");
  }
  const file = form.get("audio");
  if (
    !(file instanceof File) ||
    form.getAll("audio").length !== 1 ||
    !file.size ||
    file.size > 10_000_000 ||
    ![
      "audio/m4a",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "audio/x-m4a",
    ].includes(file.type)
  )
    throw new HttpError(
      file instanceof File && file.size > 10_000_000 ? 413 : 400,
      "Use an audio recording under 10 MB.",
      "INVALID_AUDIO",
    );
  return file;
}
