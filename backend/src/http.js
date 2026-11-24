// Small HTTP helpers shared by all routes.

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = "Please sign in") => new HttpError(401, msg);
export const forbidden = (msg = "You don't have permission to do that") => new HttpError(403, msg);
export const notFound = (msg = "Not found") => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export async function readJson(req, maxBytes = 1_000_000) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) throw new HttpError(413, "Request body too large");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request body too large");
  if (!text) return {};
  try {
    const body = JSON.parse(text);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("not an object");
    }
    return body;
  } catch {
    throw badRequest("Request body must be a JSON object");
  }
}

/** Best guess at the real client IP behind DigitalOcean's load balancer. */
export function clientIp(req, server) {
  // do-connecting-ip is set by DigitalOcean's edge. For x-forwarded-for, the last
  // hop is the one our own proxy added (earlier entries can be faked by the client).
  return (
    req.headers.get("do-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",").pop().trim() ||
    server?.requestIP?.(req)?.address ||
    "unknown"
  );
}
