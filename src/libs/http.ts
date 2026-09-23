import { ZodError } from "zod";

export type ApiRequestContext = {
  request: Request;
  requestId: string;
  route: string;
  start: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  request_limit: number;
  reset_at: string;
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}

export class RateLimitError extends HttpError {
  constructor(public result: RateLimitResult) {
    super(429, "Please take a moment before trying again.", "RATE_LIMITED");
  }
}

export const assertRateLimit = (result: RateLimitResult) => {
  if (!result.allowed) {
    throw new RateLimitError(result);
  }
};

const isRequestId = (value: string | null) =>
  value !== null && /^[a-zA-Z0-9_-]{8,128}$/.test(value);

export const createApiRequestContext = (
  request: Request,
  route: string,
): ApiRequestContext => ({
  request,
  requestId: isRequestId(request.headers.get("x-request-id"))
    ? request.headers.get("x-request-id")!
    : crypto.randomUUID(),
  route,
  start: Date.now(),
});

export const withApiErrorHandling = <TArguments extends [Request]>(
  route: string,
  handler: (...args: [...TArguments, ApiRequestContext]) => Promise<Response>,
) => {
  return async (...args: TArguments): Promise<Response> => {
    const context = createApiRequestContext(args[0], route);

    try {
      return await handler(...args, context);
    } catch (error) {
      return failure(error, context);
    }
  };
};

export const databaseError = (error: { message: string }): never => {
  const message = error.message;

  if (/CONFLICT/.test(message)) {
    throw new HttpError(
      409,
      "This changed while you were reviewing it. Refresh and review again.",
      "CONFLICT",
    );
  }

  if (/TRANSFER_OWNERSHIP/.test(message)) {
    throw new HttpError(
      409,
      "Transfer ownership or delete your shared spaces first.",
      "OWNED_SPACES",
    );
  }

  if (/UNAUTHENTICATED|ACCOUNT_DELETING/.test(message)) {
    throw new HttpError(
      403,
      "This account is unavailable.",
      "ACCOUNT_UNAVAILABLE",
    );
  }

  if (/FORBIDDEN/.test(message)) {
    throw new HttpError(
      403,
      "You do not have permission for this change.",
      "FORBIDDEN",
    );
  }

  if (/EXPIRED|UNAVAILABLE/.test(message)) {
    throw new HttpError(
      410,
      "This invitation or proposal is no longer available.",
      "EXPIRED",
    );
  }

  if (/INVALID|DUPLICATE|CANNOT/.test(message)) {
    throw new HttpError(
      400,
      "Check the details of your request.",
      "INVALID_REQUEST",
    );
  }

  throw error;
};

const applyRateLimitHeaders = (response: Response, result: RateLimitResult) => {
  response.headers.set("RateLimit-Limit", String(result.request_limit));
  response.headers.set("RateLimit-Remaining", String(result.remaining));
  response.headers.set(
    "RateLimit-Reset",
    String(Math.ceil(new Date(result.reset_at).getTime() / 1000)),
  );

  if (!result.allowed) {
    response.headers.set(
      "Retry-After",
      String(
        Math.max(
          1,
          Math.ceil((new Date(result.reset_at).getTime() - Date.now()) / 1000),
        ),
      ),
    );
  }

  return response;
};

export const failure = (error: unknown, context: ApiRequestContext) => {
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

  const rateLimit =
    mapped instanceof RateLimitError ? mapped.result : undefined;
  const url = new URL(context.request.url);

  console.error(
    JSON.stringify({
      event: "request_failed",
      requestId: context.requestId,
      route: context.route,
      method: context.request.method,
      pathname: url.pathname,
      status: mapped.status,
      code: mapped.code,
      durationMs: Date.now() - context.start,
    }),
  );

  const response = Response.json(
    { error: mapped.message, code: mapped.code, requestId: context.requestId },
    {
      status: mapped.status,
      headers: {
        "X-Request-Id": context.requestId,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        Vary: "Authorization",
      },
    },
  );

  return rateLimit ? applyRateLimitHeaders(response, rateLimit) : response;
};

export const boundedBody = async (
  request: Request,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> => {
  const declared = request.headers.get("content-length");

  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    throw new HttpError(413, "Request too large.", "BODY_TOO_LARGE");
  }

  if (!request.body) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

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
};

export const json = async (request: Request): Promise<unknown> => {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw new HttpError(
      415,
      "Send JSON for this request.",
      "UNSUPPORTED_MEDIA",
    );
  }

  const bytes = await boundedBody(request, 100_000);

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, "Malformed JSON.", "INVALID_JSON");
  }
};

export const audio = async (request: Request): Promise<File> => {
  const type = request.headers.get("content-type") ?? "";

  if (!/^multipart\/form-data\s*;/i.test(type)) {
    throw new HttpError(
      415,
      "Send a multipart recording.",
      "UNSUPPORTED_MEDIA",
    );
  }

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
  ) {
    throw new HttpError(
      file instanceof File && file.size > 10_000_000 ? 413 : 400,
      "Use an audio recording under 10 MB.",
      "INVALID_AUDIO",
    );
  }

  return file;
};

export const success = (
  body: unknown,
  context: ApiRequestContext,
  rateLimit?: RateLimitResult,
) => {
  console.info(
    JSON.stringify({
      event: "request_complete",
      requestId: context.requestId,
      route: context.route,
      method: context.request.method,
      durationMs: Date.now() - context.start,
    }),
  );

  const response = Response.json(body, {
    headers: {
      "X-Request-Id": context.requestId,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Authorization",
    },
  });

  return rateLimit ? applyRateLimitHeaders(response, rateLimit) : response;
};
